LANGS = {
    "en": "English",
    "hi": "Hindi",
    "hing": "Hinglish",
    "mr": "Marathi",
    "bn": "Bengali",
    "ta": "Tamil",
    "te": "Telugu",
}


def note(code: str) -> str:
    if code in ("", "en", None) or code not in LANGS:
        return ""
    if code == "hing":
        return ("The user writes Hinglish (Hindi in Roman script). Write chat replies in the same easy Hinglish. "
                "Write the legal document itself in formal English unless the user asks otherwise.")
    name = LANGS[code]
    return (f"The user's language is {name}. Write chat replies in {name}. Write the document itself in {name} too, "
            f"unless the user asks for English. Keep statute names, section numbers and case names in their original form.")
