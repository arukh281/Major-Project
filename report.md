# B.Tech Major Project Report — Guidelines & Content Plan

This file is the **working blueprint** for your final submission document. Use **Part I** for university rules; use **Part II** for what to write, section by section. The final report must be produced in **Microsoft Word or LaTeX** per department norms (this Markdown file is not the submission format).

---

## Part I — Department guidelines (summary)

**Institution:** Department of Computer Science and Engineering, School of CSE, Manipal University Jaipur.

**Track for this project:** **Application development** (web app: owner-first reviews + Google Business Profile integration).

### I.1 Required sequence (application development)

Arrange and bind in this order:

1. Cover page  
2. Certificate (department)  
3. Certificate (company letterhead, if applicable)  
4. Acknowledgements  
5. Abstract  
6. List of Tables (if any)  
7. List of Figures (if any)  
8. Table of Contents (with page numbers)  
9. Main chapters (see Part II)  
10. References (IEEE format, order of first citation)  
11. Appendix / Annexures (optional)

**Optional front matter:** Dedication; inner title page (same as cover content per department note).

### I.2 Abstract rules

- **Maximum one page.**  
- **Four paragraphs:**  
  1. Importance of the problem / context → **objective** of the project.  
  2. **Methodology** adopted (high level).  
  3. **Key results** and their significance (brief).  
  4. **Important tools / software** used.

### I.3 Lists and table of contents

- **List of Tables / Figures:** columns *Number*, *Title*, *Page No.*  
- **Borders:** invisible for List of Tables, List of Figures, and Table of Contents.

### I.4 References (IEEE)

- Number references in the **order they first appear** in the text.  
- In-text citations: square brackets, e.g. `[1]`.  
- **Journal / conference:** authors, “Title”, venue/journal, volume, year, pages.  
- **Books:** authors, “Title”, publisher, edition, ISBN.  
- **Web:** topic, site name (avoid long URLs), last accessed date.  
- Reference list at end: **10 pt Times New Roman, single-spaced** (when typesetting final doc).

### I.5 Formatting & submission (final document)

| Item | Requirement |
|------|-------------|
| Paper | A4, good quality (75–100 GSM bond), **single-sided** |
| Margins | 0.7" left, right, top, bottom |
| Body font | Times New Roman, 12 pt, normal, **justified**; line spacing **1.15** (note: guidelines also mention 1.5 elsewhere — **confirm with guide**) |
| Paragraph heading | Times New Roman, **bold**, 14 pt |
| Sub-paragraph heading (e.g. 1.1) | Times New Roman, *italic*, 12 pt |
| Figure caption | 10 pt, **below** figure, **centered**; label e.g. “Figure 2.1” (**chapter-wise** numbering; spell out “Figure”) |
| Table caption | 10 pt, **above** table, **centered**; label e.g. “Table 3.1” (**chapter-wise** numbering; spell out “Table”) |
| Page numbers | Continuous from Introduction chapter; **bottom** (department text mentions right vs center in different bullets — **confirm with guide**). **Exclude** abstract & TOC from numbering per guideline note. |
| Headers/footers | No extra headers/footers beyond page numbers as allowed |
| Cover | **Mustard yellow** hard cover (CMYK C0 M20 Y75 K0; RGB R255 G204 B0; hex `#FFCC00`). Block letters: title, author, supervisor, department / MUJ Jaipur. |
| Binding | Hardbound; transparency + thick front/back sheet; **major project:** avoid spiral unless department allows |
| Length | **Minimum 40 pages** (reports below may be rejected); **~90–100 pages** preferred maximum |
| Tooling | LaTeX or MS Word |
| Copies | Typically **3** hard copies (1 student + 2 submission); **1** to coordinator after presentation with guide signature; **soft copy** Word + PDF in portal — **verify current rule with coordinator** |

**Delete** any “General Guidelines” instruction page before final binding if your template includes it.

### I.6 Annexures (optional)

Suitable material: product datasheets, design drawings, standard diagrams, lengthy code/algorithms, published or submitted papers.

---

## Part II — Report structure & content to generate

Map the department’s **application development** outline to this project: **Fynd Task 2 — Owner-first reviews and Google Business Profile** (Next.js app, owner Google sign-in, tokenized customer review URL, optional GBP sync, admin console with analytics).

Below, each subsection lists **what you must produce** (text, diagrams, tables). Replace bracketed notes with your actual writing.

---

### Front matter (no chapter number)

| Section | Content to generate |
|--------|----------------------|
| **Cover** | Title; your name; reg. no.; supervisor; department; MUJ Jaipur; month/year. |
| **Certificates** | Fill department certificate (project title, CS 4270, dates, semester). Company certificate only if internship/industry component applies. |
| **Acknowledgements** | Dean/Director, HOD, supervisor, any company/lab support, faculty. |
| **Abstract** | Four paragraphs per I.2; mention owner-centric model, tokenized reviews, optional GBP, LLM-assisted triage, tech stack. |
| **List of Figures** | Every architecture diagram, use-case diagram, ER/schema diagram, screenshot (if used as figure), flowchart. |
| **List of Tables** | Requirements tables, comparison tables, environment variable summary, test-case tables, etc. |
| **Table of Contents** | All chapters and numbered subsections with page numbers. |

---

### Chapter 1 — Introduction

#### 1.1 Scope of the work

- **Generate:** Problem statement: fragmented review capture for SMBs; need for owner-controlled, shareable review channel and optional aggregation with Google public reviews.  
- **Generate:** Boundaries: what the system **does** (single business per owner, token URLs, `/admin` console, GBP OAuth) vs **does not** (e.g. no open global review form on `/`, no multi-tenant marketplace).  
- **Generate:** Target users: business owner, end customer, internal operator (owner as admin).

#### 1.2 Product scenarios

- **Generate:** 2–4 **narrative scenarios** (e.g. owner onboarding, minting link, customer submits review at `/review/[token]`, owner views analytics, owner connects GBP and syncs).  
- **Optional:** User journey diagram or sequence sketch.

#### 1.3 Requirement analysis

**1.3.1 Functional requirements**

- **Generate:** Numbered list: authentication (Google OIDC), session security, business CRUD, locations, token mint/rotate, public review fetch by token, review submission API, LLM fields on review, GBP connect/sync, admin views (internal vs Google reviews, filters, analytics endpoints).  
- **Generate:** Traceability: map each requirement to module/API (see README API summary).

**1.3.2 Non-functional requirements**

- **Generate:** Security (signed JWT session, encrypted GBP tokens, HTTPS assumption), performance expectations, scalability notes (Postgres, stateless app tier), usability (mobile-friendly review page), maintainability (Next.js App Router structure).

**1.3.3 Use case scenarios**

- **Generate:** Use case list with **actors** (Owner, Customer, System, Google APIs).  
- **Generate:** Use case diagram (UML or equivalent).  
- **Generate:** Main flows: “Submit review via token”, “Owner sync GBP”, “Owner views analytics”.

**1.3.4 Other software engineering methodologies (as applicable)**

- **Generate:** Brief mention of process: iterative development, version control, testing approach, API-first design, Prisma migrations.

---

### Chapter 2 — System design

#### 2.1 Design goals

- **Generate:** Owner isolation, least-privilege access, clear separation of public vs authenticated routes, extensibility for more platforms beyond GBP.

#### 2.2 System architecture

- **Generate:** Layered description: client (Next.js UI), server (Route Handlers / server actions), data (PostgreSQL via Prisma), external (Google OAuth, Google Business APIs, OpenRouter).  
- **Generate:** **Architecture diagram** (deployment + logical components).  
- **Generate:** **Data flow** for review submission and for GBP sync.

#### 2.3 Detailed design methodologies

- **Generate:** **Database design:** main entities (`Owner`/`User`, business, locations, reviews, tokens, Google link, external reviews) — align with `prisma/schema.prisma` (describe without dumping full schema in body; full schema can go to **Annexure**).  
- **Generate:** **API design:** table of routes, methods, auth (session cookie), request/response summary.  
- **Generate:** **Security design:** cookie signing, encryption key usage, middleware protection of `/admin`.  
- **Generate:** **LLM pipeline:** input/output (`aiResponse`, `aiSummary`, `aiActions`), model id, error handling philosophy.

---

### Chapter 3 — Work done

*(Align section numbering with your guide’s “Work Done” — if your department expects “Chapter 3” as Implementation, keep consistent with your TOC template.)*

#### 3.1 Development environment

- **Generate:** Hardware used; OS; Node.js version; editor/IDE; PostgreSQL version; Google Cloud project setup (OAuth clients, redirect URIs).  
- **Generate:** Table of **environment variables** (purpose, mandatory vs optional) from project README.

#### 3.2 Implementation details

- **Generate:** Walkthrough **modules**: authentication, owner business APIs, public review page, review submission, GBP OAuth + sync, admin UI (Business / Google / analytics).  
- **Generate:** **Screenshots** of `/`, `/admin` tabs, `/review/[token]` (sanitize any real PII).  
- **Generate:** Key algorithms only (e.g. token generation strategy, sync batching) — not full source listing unless in annexure.

#### 3.3 Results and discussion

- **Generate:** **Functional outcomes:** what works end-to-end.  
- **Generate:** **Tests:** manual test cases, optional automated tests if any; `seed:google-mock` for demo data.  
- **Generate:** **Discussion:** limitations (model cost/latency, GBP API constraints, single-business-per-owner product choice), reliability, privacy considerations.

#### 3.4 Individual contribution of project members

- **Generate:** Per-member bullets (if team): who did backend, frontend, integration, documentation, testing. If solo, state sole authorship and supervisor guidance.

---

### Chapter 4 — Conclusion and future work

#### 4.1 Conclusions

- **Generate:** Summary of objectives vs achievements; what was learned.

#### 4.2 Future work

- **Generate:** **At least three** concrete items (per sample TOC): e.g. multi-business per owner, moderation workflow, email notifications, richer analytics, additional review sources, mobile app, offline QR collateral, stronger abuse prevention.

#### 4.3 Proposed work plan of the project

- **Generate:** Timeline or phased plan if work continues (optional table: milestone, duration, deliverable).

---

### References

- **Generate:** IEEE-style entries for: Next.js / React docs, Prisma, OAuth 2.0 / OpenID specs or authoritative tutorials, Google Business Profile API documentation, OpenRouter / Llama model card or paper, PostgreSQL, any security best-practice sources cited in text.

---

### Appendix / Annexures (optional)

- **Generate:** Full Prisma schema excerpt or ERD export.  
- **Generate:** Long API payload examples, sample JSON.  
- **Generate:** Extended screenshots, user manual excerpt, or key code listings (if allowed).

---

## Part III — Suggested figure & table checklist (for List of Figures/Tables)

Use this when building the final Lists:

**Figures (examples)**

- Figure 1.1 — Use case diagram  
- Figure 2.1 — System architecture  
- Figure 2.2 — Review submission sequence diagram  
- Figure 2.3 — Entity-relationship diagram  
- Figure 3.1–3.n — Application screenshots  

**Tables (examples)**

- Table 1.1 — Functional requirements vs module  
- Table 1.2 — Non-functional requirements  
- Table 3.1 — Environment variables  
- Table 3.2 — Test cases and results  

---

## Part IV — Project summary (for your abstract / intro drafting)

**Working title (edit):** *Owner-First Customer Review Platform with Google Business Profile Integration*

**One-line description:** A Next.js 16 web application where business owners authenticate with Google, configure a single business profile and shareable review links (`/review/[token]`), optionally connect Google Business Profile to import public reviews, and use a session-gated admin console for insights and analytics; customer reviews may be enriched via an LLM (OpenRouter, Llama 3.1 8B Instruct) for structured fields.

**Core technologies:** Next.js (App Router), React 19, Tailwind 4, Prisma 5, PostgreSQL, Google OAuth (OIDC + GBP), OpenRouter LLM.

---

*End of `report.md`. Before binding, reconcile any conflicting guideline bullets (line spacing, page number position) with your project guide.*
