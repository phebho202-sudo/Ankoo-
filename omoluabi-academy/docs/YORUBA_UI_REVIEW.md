# Yoruba interface text: language review

The dashboard's Yoruba text was written with full tone marks, but it has **not yet been
reviewed by a fluent Nigerian Yoruba speaker**. Please have a reviewer go through the table
below and mark corrections in the "Reviewer correction" column (or send them back in any form).

Points worth special attention:
* Terms chosen for new concepts: *ìpín* (episode), *ìtẹ̀jáde* (publishing), *àkọsílẹ̀
  àyẹ̀wò* (audit trail), *ìpawówọlé* (monetisation), *ọ̀rọ̀ aṣínà* (password), *ìkànnì
  àjọlò* (social media), *aládàáṣe* (automatic), *ìpele* (phase).
* Tone and register: it should read as natural, respectful Nigerian Yoruba for a business
  owner, not a word-for-word translation.
* Technical words left in English on purpose: API, Redis, FFmpeg, TTS, avatar, affiliate,
  YouTube, TikTok, Meta, USD.

Source of truth: `frontend/src/lib/i18n/dictionaries.ts`. Regenerate this file after edits with
`cd frontend && npm run -s i18n:review > ../docs/YORUBA_UI_REVIEW.md`.

| Key | English | Yorùbá | Reviewer correction |
|---|---|---|---|
| `common.appName` | OMỌLÚÀBÍ BUSINESS ACADEMY | OMỌLÚÀBÍ BUSINESS ACADEMY | |
| `common.tagline` | Practical business education in Yoruba | Ẹ̀kọ́ iṣẹ́ òwò tó wúlò ní èdè Yorùbá | |
| `common.admin` | Admin | Ìṣàkóso | |
| `common.logout` | Log out | Jáde | |
| `common.language` | Language | Èdè | |
| `common.english` | English | English | |
| `common.yoruba` | Yorùbá | Yorùbá | |
| `common.save` | Save | Fi pamọ́ | |
| `common.saving` | Saving… | Ó ń fi pamọ́… | |
| `common.saved` | Saved | A ti fi pamọ́ | |
| `common.ok` | OK | Ó ń ṣiṣẹ́ | |
| `common.down` | Down | Kò ṣiṣẹ́ | |
| `common.yes` | Yes | Bẹ́ẹ̀ni | |
| `common.no` | No | Rárá | |
| `common.phase` | Phase {n} | Ìpele {n} | |
| `common.notBuiltYet` | Not built yet | A kò tíì kọ́ ọ | |
| `common.menu` | Menu | Àkójọ | |
| `common.close` | Close | Pa á dé | |
| `common.signedInAs` | Signed in as | O wọlé gẹ́gẹ́ bí | |
| `common.unreachable` | The backend cannot be reached. No data is shown until it responds. | A kò lè dé ọ̀dọ̀ sáfà. A kò ní fi dátà kankan hàn títí yóò fi dáhùn. | |
| `nav.groups.main` | Main | Pàtàkì | |
| `nav.groups.content` | Content | Àkóónú | |
| `nav.groups.production` | Production | Ìṣẹ̀dá | |
| `nav.groups.distribution` | Distribution | Ìpínkiri | |
| `nav.groups.business` | Business | Òwò | |
| `nav.groups.system` | System | Sístẹ́mù | |
| `nav.overview` | Overview | Àkópọ̀ | |
| `nav.episodes` | Episode catalogue | Àkójọ àwọn ìpín | |
| `nav.rights` | Rights management | Ìṣàkóso ẹ̀tọ́ | |
| `nav.research` | Research | Ìwádìí | |
| `nav.scripts` | Yoruba scripts | Àkọsílẹ̀ Yorùbá | |
| `nav.voice` | Voice production | Ìṣẹ̀dá ohùn | |
| `nav.video` | Video production | Ìṣẹ̀dá fídíò | |
| `nav.calendar` | Publishing calendar | Kàlẹ́ńdà ìtẹ̀jáde | |
| `nav.accounts` | Social accounts | Àwọn àkáǹtì ìkànnì àjọlò | |
| `nav.analytics` | Analytics | Ìtúpalẹ̀ ìṣirò | |
| `nav.monetisation` | Monetisation | Ìpawówọlé | |
| `nav.settings` | System settings | Ètò sístẹ́mù | |
| `login.title` | Log in to the admin dashboard | Wọlé sí ojú-ìṣàkóso | |
| `login.email` | Email | Ímeèlì | |
| `login.password` | Password | Ọ̀rọ̀ aṣínà | |
| `login.submit` | Log in | Wọlé | |
| `login.submitting` | Logging in… | Ó ń wọlé… | |
| `login.invalid` | Incorrect email or password. | Ímeèlì tàbí ọ̀rọ̀ aṣínà kò tọ̀nà. | |
| `login.locked` | Too many failed attempts. Please try again in 15 minutes. | Ìgbìyànjú tí kò yọrí ti pọ̀ jù. Jọ̀ọ́ gbìyànjú lẹ́ẹ̀kan sí i lẹ́yìn ìṣẹ́jú mẹ́ẹ̀ẹ́dógún. | |
| `login.expired` | Your session has ended. Please log in again. | Àkókò ìwọlé rẹ ti parí. Jọ̀ọ́ wọlé lẹ́ẹ̀kan sí i. | |
| `login.unreachable` | Cannot reach the server. Please try again shortly. | A kò lè dé ọ̀dọ̀ sáfà. Jọ̀ọ́ gbìyànjú láìpẹ́. | |
| `overview.title` | Overview | Àkópọ̀ | |
| `overview.subtitle` | The live state of the academy's systems. Every number here comes from the database. | Ipò àwọn ẹ̀rọ ilé-ẹ̀kọ́ náà lọ́wọ́lọ́wọ́. Gbogbo nọ́ńbà ibí yìí wá láti inú ibi ìpamọ́ dátà. | |
| `overview.health` | System health | Ìlera sístẹ́mù | |
| `overview.api` | API | API | |
| `overview.database` | Database | Ibi ìpamọ́ dátà | |
| `overview.redis` | Job queue (Redis) | Ìlà iṣẹ́ (Redis) | |
| `overview.providerMode` | Provider mode | Ipò àwọn olùpèsè | |
| `overview.sampleMode` | SAMPLE: no paid APIs are called | ÀPẸẸRẸ: a kò pe API tí a ń sanwó fún | |
| `overview.liveMode` | LIVE: real providers in use | GIDI: àwọn olùpèsè gidi ni a ń lò | |
| `overview.environment` | Environment | Àyíká | |
| `overview.spend` | Spend this month | Ìnáwó oṣù yìí | |
| `overview.ofLimit` | of {limit} monthly limit | nínú òpin oṣooṣù {limit} | |
| `overview.spendNote` | Real provider costs only. Sample runs cost nothing. | Owó gidi tí a ná lórí àwọn olùpèsè nìkan. Àwọn àpẹẹrẹ kò náwó kankan. | |
| `overview.alertAt` | Alert at {pct}% | Ìkìlọ̀ ní {pct}% | |
| `overview.jobs` | Background jobs | Àwọn iṣẹ́ abẹ́lẹ̀ | |
| `overview.jobStatus.queued` | Queued | Ń dúró | |
| `overview.jobStatus.running` | Running | Ń lọ lọ́wọ́ | |
| `overview.jobStatus.succeeded` | Succeeded | Ó yọrí | |
| `overview.jobStatus.failed` | Failed | Kò yọrí | |
| `overview.jobStatus.blocked` | Blocked by a rule | Òfin dí i lọ́nà | |
| `overview.audit` | Audit trail | Àkọsílẹ̀ àyẹ̀wò | |
| `overview.auditOk` | Intact. {n} entries verified. | Kò sí àyípadà. A ti ṣàyẹ̀wò àkọsílẹ̀ {n}. | |
| `overview.auditBad` | Tampering detected. Investigate immediately. | A rí àyípadà tí kò bófin mu. Ṣèwádìí lẹ́sẹ̀kẹsẹ̀. | |
| `overview.recent` | Recent activity | Ìṣẹ̀lẹ̀ àìpẹ́ | |
| `overview.noActivity` | No activity recorded yet. | Kò sí ìṣẹ̀lẹ̀ kankan tí a kọ sílẹ̀ síbẹ̀. | |
| `overview.setup` | Setup checklist | Àwọn ìgbésẹ̀ ìṣètò | |
| `overview.setupNote` | Each key needs your authorisation before it is added. | Kọ́kọ́rọ́ kọ̀ọ̀kan nílò àṣẹ rẹ kí a tó fi kún un. | |
| `overview.checklist.owner_account` | Owner account created | A ti ṣẹ̀dá àkáǹtì ọ̀gá | |
| `overview.checklist.anthropic_key` | Claude API key added | A ti fi kọ́kọ́rọ́ Claude API kún un | |
| `overview.checklist.elevenlabs_key` | ElevenLabs key added | A ti fi kọ́kọ́rọ́ ElevenLabs kún un | |
| `overview.checklist.youtube_key` | YouTube Data API key added | A ti fi kọ́kọ́rọ́ YouTube Data API kún un | |
| `overview.checklist.live_mode` | Live mode switched on | A ti tan ipò gidi | |
| `overview.providers` | Service providers | Àwọn olùpèsè iṣẹ́ | |
| `overview.capability.llm` | Language model | Ẹ̀rọ èdè | |
| `overview.capability.tts` | Voice (TTS) | Ohùn (TTS) | |
| `overview.capability.avatar` | Avatar presenter | Olùkọ́ avatar | |
| `overview.capability.storage` | Storage | Ibi ìpamọ́ | |
| `overview.capability.video_source` | Video discovery | Ìwádìí fídíò | |
| `overview.capability.publisher` | Publishing | Ìtẹ̀jáde | |
| `overview.providerState.sample` | Sample | Àpẹẹrẹ | |
| `overview.providerState.connected` | Ready | Ó ti ṣe tán | |
| `overview.providerState.notConfigured` | Not configured | A kò tíì ṣètò rẹ̀ | |
| `placeholder.whatItWillDo` | What this page will do | Ohun tí ojú-ìwé yìí yóò ṣe | |
| `placeholder.safeguards` | Built-in safeguards | Àwọn ààbò tí a kọ́ sínú rẹ̀ | |
| `placeholder.empty` | Nothing here yet. This page will show real records once Phase {n} is complete. No sample data is shown. | Kò sí nǹkan níbí síbẹ̀. Ojú-ìwé yìí yóò fi àkọsílẹ̀ gidi hàn lẹ́yìn tí Ìpele {n} bá parí. A kò fi dátà àpẹẹrẹ hàn. | |
| `pages.episodes.purpose` | Every source video discovered from authorised channels, with its details, transcript status and protection against duplicates. | Gbogbo fídíò orísun tí a rí láti inú àwọn ikanni tí o fún láṣẹ, pẹ̀lú àlàyé wọn, ipò àkọsílẹ̀ ọ̀rọ̀ wọn, àti ìdènà fún fídíò tí a ti ní tẹ́lẹ̀. | |
| `pages.episodes.safeguards[0]` | Only channels you authorise are scanned. | Àwọn ikanni tí o fún láṣẹ nìkan ni a ó yẹ̀wò. | |
| `pages.episodes.safeguards[1]` | The same video can never be added twice. | A kò lè fi fídíò kan náà kún un lẹ́ẹ̀mejì. | |
| `pages.rights.purpose` | Licences and permissions for every adaptation: translation, adaptation, commercial and distribution rights, permitted platforms and expiry dates. | Ìwé àṣẹ àti ìyọ̀ǹda fún àtúnṣe kọ̀ọ̀kan: ẹ̀tọ́ ìtumọ̀, ẹ̀tọ́ àtúnṣe, ẹ̀tọ́ òwò àti ẹ̀tọ́ ìpínkiri, àwọn ìkànnì tí a gbà láàyè, àti ọjọ́ tí àṣẹ yóò parí. | |
| `pages.rights.safeguards[0]` | Adaptation and publishing are blocked if permission is missing, expired or unclear. | A ó dí àtúnṣe àti ìtẹ̀jáde lọ́nà bí ìyọ̀ǹda kò bá sí, tí ó ti parí, tàbí tí kò ṣe kedere. | |
| `pages.rights.safeguards[1]` | Original lessons must be independently written. | Ẹ̀kọ́ tuntun gbọ́dọ̀ jẹ́ èyí tí a kọ fúnra wa. | |
| `pages.research.purpose` | Topic extraction and structured research reports. You choose which subjects become original Yoruba lessons. | Yíyọ àwọn kókó ọ̀rọ̀ jáde àti ìròyìn ìwádìí tó wà létòlétò. Ìwọ ni yóò yan kókó tí yóò di ẹ̀kọ́ Yorùbá tuntun. | |
| `pages.research.safeguards[0]` | Nothing becomes a lesson without your approval. | Kò sí ohun tí yóò di ẹ̀kọ́ láìsí ìfọwọ́sí rẹ. | |
| `pages.scripts.purpose` | Yoruba lesson scripts with correct tone marks, revisions, a pronunciation dictionary, and English and Yoruba subtitles. | Àkọsílẹ̀ ẹ̀kọ́ ní èdè Yorùbá pẹ̀lú àmì ohùn tó tọ̀nà, àtúnyẹ̀wò, ìwé atúmọ̀ ìpè ọ̀rọ̀, àti àkọlé ìsàlẹ̀ ní Gẹ̀ẹ́sì àti Yorùbá. | |
| `pages.scripts.safeguards[0]` | Every script passes human language review. | Ènìyàn tó gbọ́ èdè dáadáa gbọ́dọ̀ ṣàyẹ̀wò àkọsílẹ̀ kọ̀ọ̀kan. | |
| `pages.scripts.safeguards[1]` | An automated quality score is a guide, never proof of perfect Yoruba. | Máàkì àyẹ̀wò láti ọwọ́ ẹ̀rọ jẹ́ ìtọ́sọ́nà nìkan, kì í ṣe ẹ̀rí pé Yorùbá náà péye. | |
| `pages.voice.purpose` | Narration in the voice of the academy's original Nigerian Yoruba presenter, pronunciation tests, and the cost of each job. | Ohùn ìsọ̀rọ̀ olùkọ́ Yorùbá ọmọ Nàìjíríà tí ilé-ẹ̀kọ́ náà ṣẹ̀dá, ìdánwò ìpè ọ̀rọ̀, àti iye owó iṣẹ́ kọ̀ọ̀kan. | |
| `pages.voice.safeguards[0]` | Pronunciation is tested before large-scale generation. | A ó dán ìpè ọ̀rọ̀ wò kí a tó ṣe ohùn lọ́pọ̀lọpọ̀. | |
| `pages.voice.safeguards[1]` | Every job's cost is recorded. | A ó kọ iye owó iṣẹ́ kọ̀ọ̀kan sílẹ̀. | |
| `pages.video.purpose` | 16:9 lessons, vertical Shorts and Reels, thumbnails and captions, rendered with FFmpeg. | Ẹ̀kọ́ 16:9, fídíò ìdúró (Shorts àti Reels), àwòrán àfihàn àti àkọlé, tí a ṣe pẹ̀lú FFmpeg. | |
| `pages.video.safeguards[0]` | The low-cost hybrid format is the default. | Ọ̀nà àdàpọ̀ tí kò wọ́n ni a ó máa lò. | |
| `pages.video.safeguards[1]` | Every video must carry substantial original educational value. | Fídíò kọ̀ọ̀kan gbọ́dọ̀ ní ẹ̀kọ́ tuntun tó jinlẹ̀. | |
| `pages.calendar.purpose` | Scheduled releases on YouTube, Facebook, Instagram and TikTok, with upload confirmations and logs. | Ètò ìgbà ìtẹ̀jáde lórí YouTube, Facebook, Instagram àti TikTok, pẹ̀lú ìfìdímúlẹ̀ ìgbéjáde àti àkọsílẹ̀. | |
| `pages.calendar.safeguards[0]` | Nothing is published without approval and a passed rights check. | A kò ní tẹ ohunkóhun jáde láìsí ìfọwọ́sí àti àyẹ̀wò ẹ̀tọ́ tó yege. | |
| `pages.calendar.safeguards[1]` | New integrations start in private or draft mode. | Ìsopọ̀ tuntun yóò bẹ̀rẹ̀ ní ipò àṣírí tàbí àkọ́pamọ́. | |
| `pages.calendar.safeguards[2]` | Automatic publishing unlocks only after you approve the first 10 videos. | Ìtẹ̀jáde aládàáṣe yóò ṣí sílẹ̀ lẹ́yìn tí o bá fọwọ́ sí fídíò mẹ́wàá àkọ́kọ́ nìkan. | |
| `pages.accounts.purpose` | Connected YouTube, Meta and TikTok accounts and the state of their permissions. | Àwọn àkáǹtì YouTube, Meta àti TikTok tí a so pọ̀ àti ipò àṣẹ wọn. | |
| `pages.accounts.safeguards[0]` | Publishing stops automatically when an account's permissions expire. | Ìtẹ̀jáde yóò dúró fúnra rẹ̀ nígbà tí àṣẹ àkáǹtì kan bá parí. | |
| `pages.accounts.safeguards[1]` | Access tokens are stored encrypted and never displayed. | A ń fi kọ́kọ́rọ́ ìwọlé pamọ́ ní ìkọ̀kọ̀, a kò sì ní fi hàn láé. | |
| `pages.analytics.purpose` | Views, watch time and audience growth for each video and platform, from the platforms' own reports. | Iye ìwò, àkókò wíwò àti ìdàgbàsókè àwọn olùwò fún fídíò àti ìkànnì kọ̀ọ̀kan, láti inú ìròyìn tí àwọn ìkànnì náà fúnra wọn gbé jáde. | |
| `pages.analytics.safeguards[0]` | Figures come only from platform data, never estimates presented as facts. | Àwọn nọ́ńbà yóò wá láti inú dátà àwọn ìkànnì nìkan, kì í ṣe àmọ̀rò tí a gbé kalẹ̀ bí òtítọ́. | |
| `pages.monetisation.purpose` | Affiliate links, digital products, sponsorships and YouTube earnings. | Ìjápọ̀ affiliate, ọjà oní-nọ́ńbà, ìgbọ̀wọ́ àti owó tí a ń rí lórí YouTube. | |
| `pages.monetisation.safeguards[0]` | No earnings are shown until they are actually reported. | A kò ní fi owó-wíwọlé kankan hàn títí tí a ó fi gbà á ní ti gidi. | |
| `pages.monetisation.safeguards[1]` | YouTube monetisation is never assumed to be approved. | A kò ní rò pé YouTube ti fọwọ́ sí ìpawówọlé láìsí ẹ̀rí. | |
| `settings.title` | System settings | Ètò sístẹ́mù | |
| `settings.subtitle` | Limits and rules the platform must obey. Every change is recorded in the audit trail. | Àwọn òpin àti òfin tí sístẹ́mù gbọ́dọ̀ tẹ̀lé. A ń kọ gbogbo àyípadà sínú àkọsílẹ̀ àyẹ̀wò. | |
| `settings.categories.budget` | Budget and cost control | Ìṣúná àti ìṣàkóso ìnáwó | |
| `settings.categories.storage` | Storage | Ibi ìpamọ́ | |
| `settings.categories.publishing` | Publishing | Ìtẹ̀jáde | |
| `settings.categories.production` | Production | Ìṣẹ̀dá | |
| `settings.default` | Default | Àtilẹ̀wá | |
| `settings.custom` | Changed | A ti yí i padà | |
| `settings.changedBy` | Last changed by {who} | Ẹni tó yí i padà kẹ́yìn: {who} | |
| `settings.spendingLimit` | Spending limit | Òpin ìnáwó | |
| `settings.range` | Allowed: {min} to {max} | Ohun tí a gbà: {min} sí {max} | |
| `settings.confirmIncrease` | I approve raising this spending limit | Mo fọwọ́ sí i pé kí a gbé òpin ìnáwó yìí sókè | |
| `settings.needsConfirmation` | Raising a spending limit needs your explicit approval. Tick the box to confirm. | Gbígbé òpin ìnáwó sókè nílò ìfọwọ́sí rẹ. Fi àmì sí àpótí náà láti fìdí rẹ̀ múlẹ̀. | |
| `settings.autoPublishBlocked` | Automatic publishing stays off until the publishing system is built and you have approved the first 10 videos. | Ìtẹ̀jáde aládàáṣe yóò wà ní pípa títí tí a ó fi kọ́ ètò ìtẹ̀jáde, tí o sì fọwọ́ sí fídíò mẹ́wàá àkọ́kọ́. | |
| `settings.invalid` | This value was not accepted: {msg} | A kò gba iye yìí: {msg} | |
| `settings.failed` | The change could not be saved: {msg} | A kò lè fi àyípadà náà pamọ́: {msg} | |
| `settings.on` | On | Títàn | |
| `settings.off` | Off | Pípa | |
| `settings.choices.private` | Private | Àṣírí | |
| `settings.choices.unlisted` | Unlisted | Kò sí nínú àkójọ | |
| `settings.choices.hybrid` | Hybrid (low cost) | Àdàpọ̀ (owó kékeré) | |
| `settings.choices.full_avatar` | Full avatar | Avatar pípé | |
| `settings.labels.budget.monthly_limit_usd` | Monthly spending limit | Òpin ìnáwó oṣooṣù | |
| `settings.labels.budget.alert_threshold_percent` | Spending alert at | Ìkìlọ̀ ìnáwó ní | |
| `settings.labels.budget.max_cost_per_video_usd` | Maximum cost per video | Owó tó pọ̀ jù fún fídíò kan | |
| `settings.labels.budget.max_avatar_minutes_per_month` | Avatar minutes per month | Ìṣẹ́jú avatar lóṣù | |
| `settings.labels.budget.max_retries_per_job` | Maximum retries per job | Ìgbìyànjú tó pọ̀ jù fún iṣẹ́ kan | |
| `settings.labels.storage.max_storage_gb` | Storage limit | Òpin ibi ìpamọ́ | |
| `settings.labels.publishing.auto_publish_enabled` | Automatic publishing | Ìtẹ̀jáde aládàáṣe | |
| `settings.labels.publishing.required_approved_videos` | Approved videos before automation | Fídíò tí a fọwọ́ sí kí aládàáṣe tó bẹ̀rẹ̀ | |
| `settings.labels.publishing.default_visibility` | Default upload visibility | Ìrísí ìgbéjáde àtilẹ̀wá | |
| `settings.labels.production.default_video_format` | Default video format | Ọ̀nà fídíò àtilẹ̀wá | |
| `settings.help.budget.monthly_limit_usd` | Maximum total provider spend per calendar month. | Àpapọ̀ owó tó pọ̀ jù tí a lè ná lórí àwọn olùpèsè ní oṣù kan. | |
| `settings.help.budget.alert_threshold_percent` | Alert the owner when monthly spend reaches this share of the limit. | Kìlọ̀ fún ọ̀gá nígbà tí ìnáwó oṣù bá dé ìpín yìí nínú òpin. | |
| `settings.help.budget.max_cost_per_video_usd` | A video job stops if its provider cost would exceed this. | Iṣẹ́ fídíò yóò dúró bí owó rẹ̀ bá fẹ́ kọjá iye yìí. | |
| `settings.help.budget.max_avatar_minutes_per_month` | Avatar rendering minutes allowed per month (0 = hybrid format only). | Ìṣẹ́jú avatar tí a gbà láàyè lóṣù (0 = ọ̀nà àdàpọ̀ nìkan). | |
| `settings.help.budget.max_retries_per_job` | Retry cap for a failed job. Each retry can cost money. | Iye ìgbà tí a lè tún gbìyànjú iṣẹ́ tí kò yọrí. Ìgbìyànjú kọ̀ọ̀kan lè náwó. | |
| `settings.help.storage.max_storage_gb` | Total media storage allowed. | Àpapọ̀ ibi ìpamọ́ tí a gbà láàyè fún fídíò àti ohùn. | |
| `settings.help.publishing.auto_publish_enabled` | Publish approved videos automatically on schedule. | Tẹ fídíò tí a fọwọ́ sí jáde fúnra rẹ̀ ní àkókò tí a ṣètò. | |
| `settings.help.publishing.required_approved_videos` | Owner-approved videos required before automatic publishing can be enabled (minimum 10). | Iye fídíò tí ọ̀gá gbọ́dọ̀ fọwọ́ sí kí ìtẹ̀jáde aládàáṣe tó ṣeé ṣe (ó kéré tán mẹ́wàá). | |
| `settings.help.publishing.default_visibility` | Visibility for new uploads. Public is not allowed during the trial period. | Ìrísí fún fídíò tuntun. A kò gbà á láàyè fún gbogbo ènìyàn nígbà ìdánwò. | |
| `settings.help.production.default_video_format` | Default presenter format. Hybrid is the low-cost default. | Ọ̀nà olùkọ́ àtilẹ̀wá. Àdàpọ̀ ni èyí tí owó rẹ̀ kéré. | |
| `settings.audit` | Audit trail | Àkọsílẹ̀ àyẹ̀wò | |
| `settings.auditSubtitle` | Every login, change and job, newest first. Entries cannot be edited or deleted. | Gbogbo ìwọlé, àyípadà àti iṣẹ́, láti tuntun jùlọ. A kò lè ṣàtúnṣe tàbí pa àkọsílẹ̀ rẹ́. | |
| `settings.time` | Time | Àkókò | |
| `settings.actor` | By | Ẹni | |
| `settings.action` | Action | Ìgbésẹ̀ | |
| `settings.item` | Item | Nǹkan | |
| `settings.older` | Older entries | Àkọsílẹ̀ àtẹ̀yìnwá | |
| `settings.newest` | Back to newest | Padà sí tuntun jùlọ | |
