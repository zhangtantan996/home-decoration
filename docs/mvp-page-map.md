# MVP Page Map

## Purpose

This document maps the current product direction into concrete page-level responsibilities for the three-web strategy:

- User Web
- Merchant Web
- Admin Web

It is meant to guide navigation convergence, feature hiding, delivery sequencing, and future migration planning.

---

## 1. User Web MVP page map

The User Web is the **decision / confirmation / collaboration surface**.

It should help users:

- submit real demands,
- understand matched merchants,
- compare options,
- confirm project steps,
- track progress,
- handle exceptions.

### P0 pages

#### 1. Home / Entry page

Primary role:

- introduce platform trust loop,
- drive demand submission,
- explain key process.

Key responsibilities:

- clear CTA for demand submission,
- short explanation of matching / contract / milestone / dispute support,
- selective merchant/case showcase if it supports conversion.

#### 2. Demand submission page

Primary role:

- capture structured demand.

Key responsibilities:

- requirement type,
- location / city / project basics,
- budget / area / timeline,
- description and attachments,
- save draft / submit.

#### 3. My demands list page

Primary role:

- show all submitted demands and their latest state.

Key responsibilities:

- demand status,
- latest update,
- pending user action,
- match progress entry.

#### 4. Demand detail page

Primary role:

- show demand lifecycle and platform handling state.

Key responsibilities:

- demand details,
- review state,
- supplement requests,
- matching progress,
- linked merchant recommendations.

#### 5. Provider list page

Primary role:

- support provider browsing and decision filtering.

Key responsibilities:

- provider summary,
- unified quote display,
- filtering,
- role/type visibility,
- clear route to provider detail.

#### 6. Provider detail page

Primary role:

- support provider decision-making.

Key responsibilities:

- profile and capabilities,
- cases,
- quote block,
- service tags,
- cooperation CTA / recommendation context if applicable.

#### 7. Quote / proposal comparison page

Primary role:

- help users compare 3–5 candidate merchants in a structured way.

Key responsibilities:

- quote comparison,
- service scope comparison,
- timeline comparison,
- strengths / notes,
- select / reject actions.

#### 8. Contract / milestone confirmation page

Primary role:

- confirm cooperation and execution rules.

Key responsibilities:

- selected merchant,
- contract attachment / summary,
- milestone breakdown,
- payment rhythm explanation,
- confirmation records.

#### 9. Project progress board

Primary role:

- become the main project collaboration hub.

Key responsibilities:

- current stage,
- milestone timeline,
- acceptance status,
- change-order status,
- complaint / dispute entry,
- payment-state visibility.

#### 10. Acceptance page

Primary role:

- confirm or reject milestone completion.

Key responsibilities:

- submitted delivery materials,
- milestone scope,
- acceptance opinion,
- approve / reject / escalate to dispute.

#### 11. Change-order page

Primary role:

- control all price/scope/timeline changes.

Key responsibilities:

- change reason,
- amount impact,
- timeline impact,
- initiator,
- user confirmation or rejection,
- status history.

#### 12. Complaint / dispute page

Primary role:

- let users raise exceptions in-system.

Key responsibilities:

- complaint category,
- issue description,
- evidence upload,
- processing progress,
- freeze / dispute indicators,
- closure result.

#### 13. My projects page

Primary role:

- list all active and historical projects.

Key responsibilities:

- project status,
- current milestone,
- pending actions,
- direct entry to acceptance / change / complaint.

#### 14. Evaluation page

Primary role:

- finish the transaction loop and feed credibility signals.

Key responsibilities:

- score,
- text review,
- optional dimension ratings.

### P1 pages

- case / inspiration discovery pages
- browsing history / favorites
- in-context chat page
- secondary content pages that help conversion but do not define the main loop

### P2 pages

- community / forum
- live site features
- AI quote recommendation as a promoted flow
- marketplace-first surfaces not tied to the transaction loop
- points / membership systems

---

## 2. Merchant Web MVP page map

The Merchant Web is the **fulfillment / execution workspace**.

It should help merchants:

- onboard,
- maintain qualified presence,
- receive matched work,
- submit quotes,
- execute projects,
- handle changes / complaints,
- track collection status.

### P0 pages

#### 1. Merchant login / registration page

Primary role:

- entry point for merchant identity.

#### 2. Onboarding / application page

Primary role:

- complete merchant application and capability declaration.

Key responsibilities:

- profile info,
- certifications,
- qualifications,
- service areas,
- pricing basics,
- product / goods info where applicable,
- business-hours or special fields where needed.

#### 3. Review status page

Primary role:

- show current approval state and required corrections.

Key responsibilities:

- state,
- rejection reason,
- required supplements,
- resubmission entry.

#### 4. Merchant workspace home

Primary role:

- show what requires action now.

Key responsibilities:

- new assigned demands,
- pending quote tasks,
- active projects,
- pending milestone submissions,
- collection summary,
- platform notices.

#### 5. Profile / capability management page

Primary role:

- maintain merchant business presence.

Key responsibilities:

- service intro,
- tags,
- areas,
- business identity,
- pricing basics,
- visibility-critical information.

#### 6. Case management page

Primary role:

- maintain project/case evidence for conversion.

#### 7. Goods / service management page

Primary role:

- manage product or service entries where relevant.

Key responsibilities:

- create / edit,
- status,
- unit / description / price basics,
- visibility-related completeness.

#### 8. Assigned demand / lead page

Primary role:

- manage incoming opportunities from the platform.

Key responsibilities:

- demand summary,
- response status,
- accept / decline / quote entry,
- deadline awareness.

#### 9. Quote / proposal editor page

Primary role:

- submit structured quote and plan.

Key responsibilities:

- pricing lines,
- timeline,
- scope,
- explanation,
- versioning / update time.

#### 10. Project list page

Primary role:

- list all execution items.

#### 11. Project detail page

Primary role:

- manage ongoing fulfillment.

Key responsibilities:

- contract,
- milestones,
- acceptance records,
- change orders,
- dispute state,
- collection state.

#### 12. Milestone delivery submission page

Primary role:

- submit milestone completion evidence.

Key responsibilities:

- delivery text,
- image/video/material upload,
- completion notes,
- acceptance request submission.

#### 13. Change-order handling page

Primary role:

- review and confirm change requests.

#### 14. Complaint / after-sales response page

Primary role:

- respond to platform-managed complaints or after-sales issues.

#### 15. Collection / withdrawal page

Primary role:

- track income status and handle withdrawal.

Key responsibilities:

- milestone money state,
- withdrawal eligibility,
- bank account status,
- withdrawal record.

### P1 pages

- merchant message center
- chat center
- lightweight business analytics
- secondary support tools

### P2 pages

- IM test pages
- experimental merchant features
- outdated non-mainline pages
- noisy dashboard panels disconnected from the MVP loop

---

## 3. Admin Web MVP page map

The Admin Web is the **review / assignment / intervention / governance control tower**.

It should help platform operators:

- approve market participants,
- assign work,
- monitor project states,
- intervene in disputes,
- manage funding rhythm,
- build credibility rules.

### P0 pages

#### 1. Admin operations dashboard

Primary role:

- show urgent operational workload.

Key responsibilities:

- pending reviews,
- pending demands,
- pending disputes,
- pending withdrawals,
- abnormal project counts.

#### 2. Review center

Primary role:

- central review entry.

Key responsibilities:

- provider review,
- material-shop review,
- identity review,
- case review where applicable.

#### 3. Merchant management page

Primary role:

- manage merchants after and beyond approval.

Key responsibilities:

- merchant list,
- visibility state,
- review history,
- freeze/unfreeze,
- detail inspection.

#### 4. Demand management page

Primary role:

- review user demands before or during assignment.

Key responsibilities:

- demand list,
- state,
- supplement requests,
- assignment readiness.

#### 5. Matching / assignment page

Primary role:

- execute platform matching.

Key responsibilities:

- candidate merchant selection,
- assignment records,
- response tracking,
- operator notes.

#### 6. Quote / proposal oversight page

Primary role:

- inspect or intervene in quote quality when needed.

#### 7. Contract / project management page

Primary role:

- observe and manage execution state.

Key responsibilities:

- project status,
- contract state,
- milestone progression,
- abnormal indicators.

#### 8. Acceptance management page

Primary role:

- inspect milestone delivery and acceptance state.

#### 9. Change-order management page

Primary role:

- observe and intervene in scope / amount changes.

#### 10. Complaint / dispute handling page

Primary role:

- resolve trust-critical exceptions.

Key responsibilities:

- category,
- dispute node tagging,
- evidence review,
- platform decision,
- payment freeze / resume,
- closure state.

#### 11. Payment / withdrawal supervision page

Primary role:

- supervise funding rhythm.

Key responsibilities:

- withdrawal review,
- freeze / release / adjustment state,
- operator notes.

#### 12. Merchant scoring / penalty page

Primary role:

- establish platform credibility governance.

Initial dimensions:

- response speed
- quote standardization
- schedule fulfillment rate
- acceptance pass rate
- complaint rate
- after-sales efficiency

Initial actions:

- warning
- ranking downgrade
- order freeze
- deposit deduction if applicable later
- removal

### P1 pages

- logs
- risk dashboards
- operational analytics
- supporting system configuration pages

### P2 pages

- legacy review entrances no longer serving as mainline entry
- technical/test pages
- immature analysis pages not tied to the transaction loop
- low-value config pages that clutter navigation

---

## 4. Cross-surface sequencing suggestion

### Phase 1 — operational backbone first

Prioritize:

- Admin review center
- Admin merchant management
- Admin demand management / assignment
- Merchant onboarding / review status
- Merchant profile / case / goods management
- Merchant quote / project execution basics
- User demand submission
- User provider list/detail
- User project progress basics

### Phase 2 — transaction trust loop completion

Prioritize:

- quote comparison
- contract / milestone confirmation
- acceptance pages
- change-order pages
- complaint / dispute handling
- payment-state visibility

### Phase 3 — governance and reinforcement

Prioritize:

- evaluation
- merchant scoring / penalty
- analytics reinforcement
- richer notifications

---

## 5. Mapping rule for future planning

Whenever a new page or module is proposed, it should answer:

1. which surface owns it (User / Merchant / Admin),
2. whether it is P0 / P1 / P2,
3. whether it directly serves the trusted transaction loop,
4. whether it should be visible in main navigation now,
5. whether it is intended to remain web-native or later migrate to mini program / app.
