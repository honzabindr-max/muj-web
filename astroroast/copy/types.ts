// AstroRoast.ai: typ veškerých viditelných textů UI (kromě <title>/meta/OG, ty jsou jen Claude a zůstávají v page souborech).
// Oba modely (claude.ts, codex.ts) implementují stejný UiCopy. Texty s interpolací jsou funkce.

import type { Element, Level, Topic } from "../types";

export interface OfferCopy {
  title: string;
  sub: string;
  price: string;
  cta: string;
  /** Krátký řádek pod výsledkem. */
  short: string;
}

export interface UiCopy {
  common: {
    skipToContent: string;
    levelNames: Record<Level, string>;
    levelBlurb: Record<Level, string>;
    topics: Record<Topic, string>;
    elements: Record<Element, string>;
    doom: string;
    disclaimerStrong: string;
    disclaimerRest: string;
    claim: string;
    claimEn: string;
  };
  header: {
    logoAria: string;
    navAria: string;
    navDaily: string;
    navSigns: string;
    navCouple: string;
  };
  footer: {
    signsAria: string;
    privacy: string;
    made: string;
    madeBrand: string;
    privacyLink: string;
    termsLink: string;
  };
  notFound: {
    badge: string;
    title: string;
    text: string;
    cta: string;
  };
  crossSell: {
    eyebrow: string;
    title: string;
    text: string;
    cta: string;
    hint: string;
  };
  landing: {
    badge: string;
    h1Before: string;
    h1Hot: string;
    leadBefore: string;
    leadAfter: string;
    en: string;
    asideAria: string;
    asideLabel: string;
    ticker: string[];
    howTitle: string;
    steps: { title: string; text: string }[];
    dailyEyebrow: (dateLabel: string) => string;
    dailyTitle: string;
    dailySub: string;
    seriesEyebrow: string;
    seriesTitle: string;
    teaserMore: (signName: string) => string;
    coupleBadge: string;
    coupleTitle: string;
    coupleText: string;
    coupleCta: string;
    signsTitle: string;
    shopEyebrow: string;
    shopTitle: string;
    shopSub: string;
  };
  couplePage: {
    badge: string;
    h1Before: string;
    h1Hot: string;
    lead: string;
  };
  signPage: {
    crumbsAria: string;
    crumbsHome: string;
    crumbsSigns: string;
    badge: (range: string, element: string) => string;
    h1Before: (signName: string) => string;
    h1Hot: string;
    h1After: string;
    motifsAria: string;
    cta: (signName: string) => string;
    todayEyebrow: (dateLabel: string) => string;
    todayTitle: (signName: string) => string;
    aboutTitle: (signName: string) => string;
    aboutP1: (signName: string, range: string, motifs: string) => string;
    aboutP2: string;
    faq: (signName: string, from: string, to: string) => { q: string; a: string }[];
    duelBadge: string;
    duelTitle: (signName: string) => string;
    duelText: (signName: string) => string;
    duelCta: string;
    moreTitle: string;
  };
  sharedRoast: {
    badge: string;
    h1Before: string;
    bigCtaLead: string;
    bigCtaSub: string;
    moreLink: (signName: string) => string;
  };
  sharedCouple: {
    badge: string;
    h1After: string;
    bigCtaLead: string;
    bigCtaBtn: string;
    bigCtaSub: string;
  };
  generator: {
    panelTitle: string;
    loadingLines: string[];
    step1: string;
    targetAria: string;
    targetSelf: string;
    targetFriend: string;
    friendNote: string;
    errNoSign: string;
    legendSelf: string;
    legendFriend: string;
    cuspLeadSelf: string;
    cuspLeadFriend: string;
    step2: string;
    lockNudge: string;
    step3: string;
    topicsAria: string;
    btnLoading: string;
    btnFriend: string;
    btnSelf: string;
    hint: string;
    statusLoading: string;
    statusDone: string;
    again: string;
    push: string;
    friendMax: string;
    maxed: string;
  };
  coupleGen: {
    loadingLines: string[];
    step1: string;
    legendA: string;
    cuspA: string;
    legendB: string;
    cuspB: string;
    step2: string;
    meterLabel: string;
    fairNote: string;
    errBoth: string;
    btnLoading: string;
    btn: string;
    hint: string;
    again: string;
    raise: string;
    maxed: string;
  };
  shareGen: {
    errNoSign: string;
    legend: string;
    cuspLead: string;
    btn: string;
    statusDone: string;
    again: string;
    push: string;
    maxed: string;
    more: string;
  };
  shareBar: {
    groupAria: string;
    share: string;
    copyLink: string;
    download: string;
    drawing: string;
    toastCopied: string;
    toastShareFail: string;
    toastCopyFail: string;
    toastDownloaded: string;
    toastDownloadFail: string;
    textCouple: (headline: string) => string;
    textFriend: (headline: string) => string;
    textSelf: (headline: string) => string;
  };
  doors: {
    offers: { year: OfferCopy; birthday_pdf: OfferCopy };
    sheetTag: string;
    sheetTitle: string;
    /** Navazuje na tučný název nabídky. */
    sheetDescAfter: string;
    sheetMore: string;
    toFree: string;
    close: string;
  };
  chooser: {
    months: string[];
    modeAria: string;
    modeDate: string;
    modePick: string;
    day: string;
    month: string;
    dateHint: string;
    signsAria: string;
    cuspAria: string;
    cuspPre: (lead: string) => string;
    cuspOr: string;
  };
  spice: {
    label: string;
    levelAria: (n: number, name: string, locked: boolean) => string;
  };
  card: {
    ariaLabel: (signName: string) => string;
    levelTag: (level: number, levelName: string) => string;
    burnLabel: string;
    burnAria: (percent: number) => string;
    verdictTag: string;
    footSelf: string;
    footFriend: string;
  };
  coupleCard: {
    battle: string;
    compatTitle: string;
    compatNote: string;
    compatAria: (percent: number) => string;
  };
}
