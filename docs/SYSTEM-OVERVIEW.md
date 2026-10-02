# TNTH LIMS — System Overview

**TNTH LIMS** is a Laboratory Information Management System for a NABL‑accredited,
multi‑discipline contract testing laboratory. It manages the complete life of a
testing job — from the first customer enquiry, through sample testing in the lab,
to the signed report delivered back to the customer — with a full, tamper‑evident
audit trail at every step.

---

## Who uses it

The system has six roles, each seeing only what they need:

| Role | What they do |
|---|---|
| **Laboratory Administrator** | Full access; user & permission management, configuration, oversight |
| **Lab Manager** | Assigns work, approves results, monitors turnaround & quality |
| **Quality Assurance (QA) Officer** | Reviews documentation, approves/releases reports, manages deviations, CAPA & audits |
| **Chemist / Analyst** | Performs testing, records observations, completes worksheets |
| **Microbiology Analyst** | Handles sterility and microbial‑limit testing workflows |
| **Client / Customer** | Submits samples, tracks progress, downloads reports, views invoices (external portal) |

---

## What it covers — the end‑to‑end testing pipeline

The heart of the system is a controlled 16‑stage workflow. A job moves forward
only when each stage is properly completed, and nothing can skip a required step.

1. **Enquiry** — capture a customer's testing request (products, tests, requirements)
2. **Quotation** — price it, get it approved internally, send it, record acceptance
3. **Test Request Form (TRF)** — formalise the accepted job with samples & commercial terms
4. **Sample Receipt** — log samples physically arriving, note condition/discrepancies
5. **Technical Review** — confirm samples & requests are suitable to test
6. **Sample Registration** — register and barcode each sample into the lab
7. **Test Allocation** — assign tests to analysts and instruments
8. **Worksheet Preparation** — prepare the bench worksheet for the analyst
9. **Testing & Result Entry** — perform tests and record results
10. **Technical Verification** — a second technical check of the results
11. **Draft Report / CoA** — generate the draft Certificate of Analysis / report
12. **QA Review** — Quality Assurance reviews the draft
13. **Authorised Approval & Release** — a signatory authorises and releases the report
14. **Customer Delivery** — deliver the released report to the customer
15. **Retention & Disposal** — track sample retention and scheduled disposal
16. **Corrections & Amendments** — controlled re‑issue if a correction is ever needed

### Supporting modules

- **Testing benches** — Assay, Dissolution, Impurity, HPLC/GC, Microbiology, Stability (ICH)
- **Quality** — Deviations, CAPA (Corrective & Preventive Action), Change Control
- **Instruments** — equipment register with calibration & maintenance status
- **Documents** — controlled documents with versioning and approvals
- **Customer Master** — customer records, contacts and documents
- **Batch Release** — disposition that requires every linked test to be approved first
- **Analytics Dashboard** — live KPIs on volume, turnaround, quality and the pipeline
- **Audit Trail** — an immutable record of every consequential action (who, what, when, before/after), aligned with 21 CFR Part 11 expectations
- **Client Portal** — a separate, external‑facing area where customers track their own jobs

---

## How the quality controls work

A few examples of the built‑in discipline:

- An **out‑of‑specification (OOS) result automatically raises a deviation** for QA to investigate — no failed result slips through.
- **QA approval is required** before a report can be released.
- **Batch release is blocked** until every linked test has been approved.
- **Every change is logged** to the audit trail with the user, timestamp, and the old/new values.

---

## Technical foundation (brief)

- Modern web application (Next.js / React), accessible from any browser — no install.
- Secure sign‑in with encrypted sessions and role‑based access control.
- Data stored in a managed **PostgreSQL** database (Supabase), hosted on **Vercel**.
- Runs 24/7 in the cloud; data is persistent and shared across all users in real time.

---

## About this demo

This environment is pre‑loaded with realistic sample data — customers, samples,
tests, quotations, TRFs, reports, quality records and a populated audit trail —
so you can explore every part of the system immediately. See the **User &
Testing Guide** for login details and a suggested walkthrough.
