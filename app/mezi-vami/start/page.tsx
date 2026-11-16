import { redirect } from "next/navigation";

// Mezikrok /start byl sloučen do formuláře (audit Z8): vstup rovnou na první osobu.
export default function MeziVamiStart() {
  redirect("/mezi-vami/osoba");
}
