# TNTH LIMS — User & Testing Guide

A practical guide to logging in and walking through the system.

---

## 1. Getting started

**Open the application:** https://tnth-lims-phi.vercel.app

No installation is needed — it runs in any modern web browser (Chrome, Edge, Safari, Firefox).

### Demo accounts

On the login screen you can **click a role button to auto‑fill** its credentials,
then press **Sign in**. Or type them manually:

| Role | Email | Password |
|---|---|---|
| Laboratory Administrator | `admin@tnth.io` | `Admin@123` |
| Lab Manager | `manager@tnth.io` | `Manager@123` |
| QA Officer | `qa@tnth.io` | `Qa@123456` |
| Chemist / Analyst | `analyst@tnth.io` | `Analyst@123` |
| Microbiology Analyst | `micro@tnth.io` | `Micro@123` |
| Client / Customer | `client@tnth.io` | `Client@123` |

> Tip: the **Administrator** account can see every screen, so it's the best one
> to explore with first. Use the other roles to see how the view changes per person.

To switch accounts, use **Sign out** (top‑right), then sign in as another role.

---

## 2. Finding your way around

- The **top bar** has the menu, a light/dark theme toggle, notifications, your
  profile, and sign‑out.
- The **left menu** lists the modules available to your role.
- The **Dashboard / Overview** gives a live snapshot: samples received, work in
  progress, approvals pending, quality issues and turnaround time.

---

## 3. Suggested walkthrough (the full job lifecycle)

The most impressive way to see the system is to follow one job from start to
finish. Sign in as **Administrator** and move through these screens in order.
The demo already contains jobs at every stage, so you can view real examples at
each step.

1. **Enquiries** — open an enquiry to see a captured customer request. Try
   **New Enquiry** to create one (pick a customer, assign a manager, add a
   product and a requested test, then **Create enquiry**).
2. **Quotations** — see draft, sent and accepted quotations. Open one to view
   pricing, approval status and customer acceptance.
3. **Test Request Forms (TRFs)** — a TRF is created from an *accepted* quotation.
   Open one to see samples and agreed commercial terms.
4. **Sample Receipt** — record samples arriving and note any discrepancies.
5. **Technical Review** — confirm the samples/requests are fit to test.
6. **Sample Registration** — register and barcode each sample.
7. **Test Allocation** — assign tests to analysts and instruments.
8. **Worksheets** — the prepared bench sheet the analyst works from.
9. **Testing benches** (Assay, Dissolution, Impurity, HPLC/GC, Microbiology,
   Stability) — where results are entered.
10. **Technical Verification** — a second technical check of entered results.
11. **Reports → Draft** — the draft Certificate of Analysis / report.
12. **QA Review** — Quality Assurance reviews the draft.
13. **Report Release** — an authorised signatory releases the report.
14. **Report Delivery** — the released report is delivered to the customer.
15. **Retention** — track sample retention and scheduled disposal.
16. **Corrections** — a controlled way to amend and re‑issue a report if needed.

Along the way, also look at:

- **Quality** → Deviations, CAPA, Change Control (note how an out‑of‑spec result
  raises a deviation automatically).
- **Instruments** → calibration and maintenance status.
- **Batch Release** → disposition that requires all tests approved first.
- **Audit Trail** → every action is logged with who/what/when and before/after
  values. Your own sign‑in will appear here.

---

## 4. The Client Portal

Sign out and sign back in as the **Client** (`client@tnth.io`). You'll land in a
completely separate, customer‑facing portal where a customer can:

- See **only their own** samples, reports and invoices (they cannot see the lab's
  internal screens).
- Track **live testing status** of each sample.
- **Submit a new sample** request.
- **Download** approved reports and view invoices.
- Exchange **messages** with the lab.

This demonstrates the strict separation between internal lab staff and external
customers.

---

## 5. Things worth testing

- **Role‑based access:** sign in as different roles and notice the menu and
  available actions change.
- **Create and save records** (e.g. a new enquiry) and confirm they appear
  immediately and persist after a refresh.
- **The audit trail:** perform an action, then check it was logged.
- **The client portal boundary:** confirm the client can't reach internal pages.

---

## 6. Notes for this demo

- This is a demonstration environment with realistic but **sample data** — feel
  free to create, edit and explore; nothing here is live production data.
- The site is hosted in the cloud and runs continuously, so your changes are
  saved and shared across everyone using the demo.
- If anything looks off on a specific screen, note the page name and what you did —
  that makes it quick to look into.

---

*Questions or feedback on the system can be sent back to the project team.*
