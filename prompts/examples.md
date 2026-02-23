# Few-Shot Examples for the Classifier

Use these to test your prompt or to include as few-shot examples if classification quality needs improvement.

## Tasks

| Input | Category | Priority | Summary |
|---|---|---|---|
| "buy milk on the way home" | Task | Low | Buy milk on the way home |
| "submit Q3 report by Friday EOD" | Task | High | Submit Q3 report by Friday |
| "update the onboarding doc with the new SSO steps" | Task | Medium | Update onboarding doc with SSO steps |
| "URGENT: server is throwing 500 errors on /checkout" | Task | High | Fix 500 errors on checkout endpoint |

## Ideas

| Input | Category | Priority | Summary |
|---|---|---|---|
| "we could probably automate the weekly standup notes with AI" | Idea | Medium | Automate weekly standup notes with AI |
| "what about a mobile app version?" | Idea | Low | Consider building a mobile app version |
| "maybe we should switch to biweekly sprints" | Idea | Medium | Consider switching to biweekly sprints |

## References

| Input | Category | Priority | Summary |
|---|---|---|---|
| "our AWS account ID is 123456789012" | Reference | Low | AWS account ID: 123456789012 |
| "great article on system design: https://example.com/post" | Reference | Low | System design article bookmark |
| "Tom's new email is tom@newcompany.com" | Reference | Medium | Tom's updated email at new company |

## Decisions

| Input | Category | Priority | Summary |
|---|---|---|---|
| "we decided to use Postgres instead of MongoDB for the new service" | Decision | Medium | Chose Postgres over MongoDB for new service |
| "going with the 3-year lease, monthly payment option" | Decision | High | Selected 3-year lease with monthly payments |

## Questions

| Input | Category | Priority | Summary |
|---|---|---|---|
| "do we have a budget for the team offsite?" | Question | Medium | Check team offsite budget availability |
| "how does the new PTO policy work for contractors?" | Question | Low | Clarify PTO policy for contractors |
| "is the API rate limit per user or per org?" | Question | Medium | Clarify API rate limit scope |

## Edge Cases (Lower Confidence)

| Input | Expected Confidence | Notes |
|---|---|---|
| "hmm" | 20 | Too vague to classify meaningfully |
| "interesting" | 25 | No actionable content |
| "meeting at 3" | 60 | Could be task or reference, missing context |
| "🔥🔥🔥" | 15 | Emoji-only, no classifiable content |
| "just had a crazy idea but I'll type it up later" | 40 | Placeholder with no substance yet |
