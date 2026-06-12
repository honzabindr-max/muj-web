#!/usr/bin/env python3
"""Layer 2C-2 v1: CZ Entity / Keyword Demand Map pipeline."""

import json, os, math, re, urllib.request, urllib.parse, sys
import pandas as pd

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", os.environ.get("SUPABASE_URL", ""))
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", os.environ.get("SUPABASE_KEY", ""))
OUT = os.path.dirname(os.path.abspath(__file__))

CZ_STOPWORDS = {
    "jak","pro","nebo","bez","ale","jako","kdy","kde","proc","proč","když","kdyz",
    "tak","aby","the","and","for","na","se","je","do","od","za","ke","ve","si",
    "to","že","ze","po","při","pri","co","kdo","čím","cim","být","byt","má","mit","mít",
    "s","z","o","v","a","i","u","k","e",
}

COMMERCIAL_TOKENS = {
    "cena","ceny","cenik","ceník","levně","levne","nejlevnější","nejlevnejsi",
    "sleva","slevy","akce","bazar","prodej","koupit","recenze","test","srovnání",
    "srovnani","nejlepší","nejlepsi","zdarma","eshop","objednat","půjčovna",
    "pujcovna","pronájem","pronajem",
}

LOCAL_TOKENS = {
    "praha","brno","ostrava","plzeň","plzen","olomouc","liberec","pardubice",
    "hradec","jihlava","zlín","zlin","česko","cesko","morava","slezsko",
}

QUESTION_TOKENS = {
    "jak","kde","kolik","proč","proc","kdy","co","kdo","návod","navod","postup",
}


def fetch_all():
    """Fetch corpus via REST API in pages."""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY,
    }
    all_rows = []
    page_size = 1000
    offset = 0
    print("Fetching corpus...")
    while True:
        params = urllib.parse.urlencode({
            "select": "phrase_norm,phrase,parent_prefix,depth",
            "gl": "eq.cz",
            "hl": "eq.cs",
            "limit": page_size,
            "offset": offset,
        })
        url = f"{SUPABASE_URL}/rest/v1/google_suggestions_v2?{params}"
        req = urllib.request.Request(url, headers=headers)
        req.add_header("Range-Unit", "items")
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read().decode())
        except Exception as e:
            print(f"  Error at offset {offset}: {e}")
            break
        if not data:
            break
        all_rows.extend(data)
        offset += page_size
        if offset % 10000 == 0:
            print(f"  ... {offset} fetched")
        if len(data) < page_size:
            break
    print(f"  Total rows fetched: {len(all_rows)}")
    return all_rows


def tokenize(phrase):
    return [t for t in phrase.lower().split() if t]


def head_term_clean(tokens):
    for t in tokens:
        if (len(t) > 1
                and not t.isdigit()
                and t not in CZ_STOPWORDS
                and re.fullmatch(r'[a-záčďéěíňóřšťúůýž\-]+', t)):
            return t
    return None


def phrase_structure(n):
    if n == 1: return "1word"
    if n == 2: return "2word"
    if n == 3: return "3word"
    return "multiword"


def build_inventory(rows):
    print("Building phrase-level inventory...")
    records = []
    for r in rows:
        raw = r.get("phrase_norm") or r.get("phrase") or ""
        q = raw.lower().strip()
        if not re.search(r'[ěščřžďťňůý]', q):
            continue
        tokens = tokenize(q)
        n = len(tokens)
        htc = head_term_clean(tokens)
        tok_set = set(tokens)
        record = {
            "source": "google_v2",
            "gl": "cz",
            "hl": "cs",
            "market_key": "cz_cs_google_v2",
            "phrase_norm": q,
            "token_count": n,
            "phrase_structure": phrase_structure(n),
            "raw_head_term": tokens[0] if tokens else None,
            "head_term_clean": htc,
            "second_token": tokens[1] if n >= 2 else None,
            "last_token": tokens[-1] if tokens else None,
            "top_bigram": " ".join(tokens[:2]) if n >= 2 else None,
            "commercial_modifier_flag": int(bool(tok_set & COMMERCIAL_TOKENS)),
            "local_modifier_flag": int(bool(tok_set & LOCAL_TOKENS)),
            "question_flag": int(bool(tok_set & QUESTION_TOKENS)),
            "numeric_product_flag": int(bool(re.search(r'\d', q))),
            "depth": r.get("depth"),
            "parent_prefix": r.get("parent_prefix"),
        }
        records.append(record)
    df = pd.DataFrame(records)
    print(f"  Inventory rows: {len(df)}")
    return df


def build_head_clusters(df):
    print("Building head term clusters...")
    df_valid = df[df["head_term_clean"].notna()].copy()

    def top5_second(series):
        vals = series.dropna()
        if vals.empty: return ""
        return ",".join(vals.value_counts().head(5).index.tolist())

    def example3(series):
        sample = series.sample(min(3, len(series)), random_state=42)
        return " | ".join(sample.tolist())

    clusters = df_valid.groupby("head_term_clean").agg(
        phrase_count=("phrase_norm", "count"),
        unique_phrase_count=("phrase_norm", "nunique"),
        avg_token_count=("token_count", "mean"),
        commercial_count=("commercial_modifier_flag", "sum"),
        local_count=("local_modifier_flag", "sum"),
        question_count=("question_flag", "sum"),
        numeric_count=("numeric_product_flag", "sum"),
        top_5_second_tokens=("second_token", top5_second),
        example_phrases=("phrase_norm", example3),
    ).reset_index()
    clusters = clusters.sort_values("phrase_count", ascending=False)
    print(f"  Clusters: {len(clusters)}")
    return clusters


def build_ngram_freq(df):
    print("Building token/bigram frequency table...")
    from collections import Counter
    tok_counter = Counter()
    tok_phrases = {}  # token -> set of phrases
    tok_as_head = Counter()
    tok_as_mod = Counter()

    big_counter = Counter()
    big_phrases = {}
    big_as_head = Counter()

    for _, row in df.iterrows():
        phrase = row["phrase_norm"]
        tokens = tokenize(phrase)
        filtered = [t for t in tokens if len(t) > 1 and not t.isdigit() and t not in CZ_STOPWORDS]

        for t in filtered:
            tok_counter[t] += 1
            if t not in tok_phrases:
                tok_phrases[t] = set()
            tok_phrases[t].add(phrase)
        if row["head_term_clean"]:
            tok_as_head[row["head_term_clean"]] += 1
        for t in filtered:
            if t != row.get("head_term_clean"):
                tok_as_mod[t] += 1

        for i in range(len(tokens) - 1):
            bg = tokens[i] + " " + tokens[i+1]
            big_counter[bg] += 1
            if bg not in big_phrases:
                big_phrases[bg] = set()
            big_phrases[bg].add(phrase)

    top_tokens = tok_counter.most_common(2000)
    top_bigrams = big_counter.most_common(2000)

    records = []
    for t, freq in top_tokens:
        records.append({
            "type": "token",
            "token_or_ngram": t,
            "frequency": freq,
            "phrase_count": len(tok_phrases.get(t, set())),
            "as_head_count": tok_as_head.get(t, 0),
            "as_modifier_count": tok_as_mod.get(t, 0),
        })
    for bg, freq in top_bigrams:
        records.append({
            "type": "bigram",
            "token_or_ngram": bg,
            "frequency": freq,
            "phrase_count": len(big_phrases.get(bg, set())),
            "as_head_count": 0,
            "as_modifier_count": 0,
        })
    ngram_df = pd.DataFrame(records)
    print(f"  Ngram rows: {len(ngram_df)}")
    return ngram_df


def build_opportunity_candidates(clusters):
    print("Building opportunity candidates...")
    valid = clusters[clusters["phrase_count"] >= 20].copy()
    valid = valid[valid["head_term_clean"].notna()]
    valid = valid[~valid["head_term_clean"].isin(CZ_STOPWORDS)]

    max_uniq = valid["unique_phrase_count"].max() or 1
    valid["commercial_signal"] = valid["commercial_count"] / valid["phrase_count"]
    valid["local_signal"] = valid["local_count"] / valid["phrase_count"]
    valid["breadth_signal"] = valid["unique_phrase_count"] / max_uniq
    valid["opportunity_relevance_score"] = (
        valid["commercial_signal"] * 0.5 +
        valid["breadth_signal"] * 0.3 +
        valid["local_signal"] * 0.2
    )

    opp = valid[[
        "head_term_clean","phrase_count","unique_phrase_count",
        "commercial_signal","local_signal","breadth_signal",
        "opportunity_relevance_score","top_5_second_tokens","example_phrases",
    ]].copy()
    opp.columns = [
        "cluster_key","phrase_count","unique_phrase_count",
        "commercial_signal","local_signal","breadth_signal",
        "opportunity_relevance_score","top_modifiers","example_phrases",
    ]
    opp = opp.sort_values("opportunity_relevance_score", ascending=False)
    print(f"  Opportunity candidates: {len(opp)}")
    return opp


def build_audit(df, clusters, opp):
    print("Building audit...")
    top10_head = clusters.head(10)["head_term_clean"].tolist()
    top10_opp = opp.head(10)["cluster_key"].tolist()
    checks = [
        ("corpus_scope", "cz_strict", ""),
        ("phrase_count", str(len(df)), ""),
        ("precision_mode", "high", ""),
        ("recall_mode", "intentionally_low", ""),
        ("not_full_market_census", "true", ""),
        ("excluded_unknown", "true", ""),
        ("excluded_segments", "no_diacritic;cz_soft_unanchored;foreign_leakage;cz_soft_clean", ""),
        ("total_phrases", str(len(df)), ""),
        ("distinct_head_terms_clean", str(df["head_term_clean"].nunique()), ""),
        ("phrases_with_null_head_clean", str(df["head_term_clean"].isna().sum()), ""),
        ("commercial_phrases", str(df["commercial_modifier_flag"].sum()), ""),
        ("local_phrases", str(df["local_modifier_flag"].sum()), ""),
        ("question_phrases", str(df["question_flag"].sum()), ""),
        ("opportunity_candidates", str(len(opp)), "cluster_quality: phrase_count>=20"),
        ("top_10_head_terms", ",".join(top10_head), ""),
        ("top_10_opportunity_clusters", ",".join(top10_opp), ""),
    ]
    audit_df = pd.DataFrame(checks, columns=["check_name", "result", "note"])
    return audit_df


def main():
    print("=== Layer 2C-2 v1: CZ Entity / Keyword Demand Map ===\n")

    # KROK A
    rows = fetch_all()

    # KROK B
    df = build_inventory(rows)
    df.to_csv(f"{OUT}/layer_2c_cz_entity_inventory.csv", index=False)
    print(f"  Saved: layer_2c_cz_entity_inventory.csv ({len(df)} rows)\n")

    # KROK C
    clusters = build_head_clusters(df)
    clusters.to_csv(f"{OUT}/layer_2c_cz_head_term_clusters.csv", index=False)
    print(f"  Saved: layer_2c_cz_head_term_clusters.csv ({len(clusters)} rows)\n")

    # KROK D
    ngram_df = build_ngram_freq(df)
    ngram_df.to_csv(f"{OUT}/layer_2c_cz_token_ngram_frequency.csv", index=False)
    print(f"  Saved: layer_2c_cz_token_ngram_frequency.csv ({len(ngram_df)} rows)\n")

    # KROK E
    opp = build_opportunity_candidates(clusters)
    opp.to_csv(f"{OUT}/layer_2c_cz_opportunity_candidates.csv", index=False)
    print(f"  Saved: layer_2c_cz_opportunity_candidates.csv ({len(opp)} rows)\n")

    # KROK F
    audit_df = build_audit(df, clusters, opp)
    audit_df.to_csv(f"{OUT}/layer_2c_v1_audit.csv", index=False)
    print(f"  Saved: layer_2c_v1_audit.csv ({len(audit_df)} rows)\n")

    # Summary stats for final report
    print("\n=== FINÁLNÍ SOUHRN ===")
    print(f"\nCSV soubory:")
    print(f"  layer_2c_cz_entity_inventory.csv:    {len(df)} řádků")
    print(f"  layer_2c_cz_head_term_clusters.csv:  {len(clusters)} řádků")
    print(f"  layer_2c_cz_token_ngram_frequency.csv: {len(ngram_df)} řádků")
    print(f"  layer_2c_cz_opportunity_candidates.csv: {len(opp)} řádků")
    print(f"  layer_2c_v1_audit.csv:               {len(audit_df)} řádků")

    print(f"\nTop 15 head terms:")
    for i, row in clusters.head(15).iterrows():
        print(f"  {row['head_term_clean']:20s} — {int(row['phrase_count']):5d} frází")

    print(f"\nTop 15 opportunity klastrů (commercial_signal):")
    for i, row in opp.head(15).iterrows():
        print(f"  {row['cluster_key']:20s} — score {row['opportunity_relevance_score']:.3f}  commercial {row['commercial_signal']:.2f}  ({int(row['phrase_count'])} frází)")

    # Zjistění
    print("\n=== 3 NEJVĚTŠÍ ZJISTĚNÍ ===")
    top_opp = opp.head(1).iloc[0]
    q_count = int(df["question_flag"].sum())
    q_pct = q_count / len(df) * 100
    comm_count = int(df["commercial_modifier_flag"].sum())
    comm_pct = comm_count / len(df) * 100
    num_count = int(df["numeric_product_flag"].sum())
    num_pct = num_count / len(df) * 100
    local_count = int(df["local_modifier_flag"].sum())
    local_pct = local_count / len(df) * 100

    print(f"1. KOMERČNÍ ZÁMĚR: {comm_count} frází ({comm_pct:.1f}%) nese komerční modifier — silný signál kupní intent v CZ vyhledávání.")
    print(f"2. OTÁZKOVÉ PATTERNY: {q_count} frází ({q_pct:.1f}%) jsou how-to/question queries — velký prostor pro informační obsah.")
    print(f"3. LOKÁLNÍ INTENT: {local_count} frází ({local_pct:.1f}%) obsahuje lokalizační token — signál geo-specifické poptávky v CZ trhu.")
    print(f"\n   Největší opportunity cluster: '{top_opp['cluster_key']}' score={top_opp['opportunity_relevance_score']:.3f}")


if __name__ == "__main__":
    main()
