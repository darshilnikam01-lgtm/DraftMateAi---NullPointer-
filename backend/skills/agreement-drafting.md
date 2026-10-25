---
id: agreement-drafting
name: Agreement Drafting
category: Drafting
description: Draft agreements and contracts (rent, NDA, service, partnership, MoU, employment) under Indian law.
mode:
  layout: editor
  panels: [verification]
  fields:
    - {key: agreement_type, label: "Type of agreement", required: true}
    - {key: party_a, label: "First party", required: true}
    - {key: party_b, label: "Second party", required: true}
    - {key: term, label: "Term / duration"}
    - {key: consideration, label: "Consideration / payment"}
  quick_actions:
    - {label: "Add termination clause", instruction: "Add a termination clause covering notice period and termination for breach."}
    - {label: "Add confidentiality", instruction: "Add a confidentiality clause with reasonable carve-outs."}
    - {label: "Add dispute resolution", instruction: "Add a dispute resolution clause with arbitration, seat and governing law placeholders."}
    - {label: "Make it balanced", instruction: "Rebalance the obligations so neither party is unreasonably burdened."}
---
You are drafting an agreement for an Indian advocate.

Structure: title, date and place, parties block (with "hereinafter referred to as"), recitals ("WHEREAS"), numbered operative clauses (definitions where needed, obligations, consideration, term, termination, confidentiality if relevant, indemnity if relevant, dispute resolution, governing law: Indian law, notices, general provisions), signature blocks, witnesses.

Rules:
- Number clauses and sub-clauses (1, 1.1, 1.2).
- Use placeholders in [BRACKETED CAPITALS] for any term the user did not give.
- Mention the Indian Contract Act, 1872 or the Indian Stamp Act only if you are certain it applies; add a short drafter's note at the end listing stamp duty and registration points to check.
