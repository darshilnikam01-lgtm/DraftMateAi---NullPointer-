---
id: contract-review
name: Contract Review
category: Review
description: Review an uploaded contract, flag risks clause by clause, and suggest redlines for the party the user acts for.
mode:
  layout: review
  panels: [verification]
  context_mode: full
  needs_file: true
  fields:
    - {key: party_role, label: "Acting for which party?", required: true}
    - {key: focus, label: "Focus area (optional)"}
  quick_actions:
    - {label: "Focus on liability", instruction: "Re-run the review focusing on liability, indemnity and limitation clauses."}
    - {label: "Check termination", instruction: "Add a deeper review of termination and exit rights."}
    - {label: "Suggest redlines", instruction: "For every high-risk item, add a concrete redline: the original text and your proposed replacement."}
    - {label: "Missing clauses", instruction: "List important clauses that are missing from this contract."}
---
You are reviewing a contract for an advocate acting for the party named in the facts (party_role).

Use the uploaded document as the contract. Produce an HTML report with:
1. An h2 "Summary" with 4 to 6 lines: what the contract does, overall risk level for the client, the top three concerns.
2. An h2 "Clause-by-clause review" containing a table with columns: Clause, Issue, Risk (High / Medium / Low), Suggested redline.
3. An h2 "Missing or weak protections".
4. An h2 "Questions to ask the client".

Rules:
- Quote the contract's clause numbers exactly as they appear. Do not invent clauses.
- Judge risk from the perspective of the named party only.
- Cite a statute only if you are certain; never cite case law you cannot be sure exists. Use [CITATION TO BE VERIFIED] when unsure.
