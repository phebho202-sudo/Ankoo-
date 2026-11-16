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
| `overview.rightsCard` | Licences | Àwọn ìwé àṣẹ | |
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
| `jobs.queued` | Queued… | Ó ń dúró… | |
| `jobs.running` | Working… | Ó ń ṣiṣẹ́… | |
| `jobs.succeeded` | Finished. | Ó ti parí. | |
| `jobs.failed` | Failed: {msg} | Kò yọrí: {msg} | |
| `jobs.blocked` | Stopped by a rule: {msg} | Òfin kan dá a dúró: {msg} | |
| `jobs.slow` | Still running. Refresh the page later to see the result. | Ó ṣì ń ṣiṣẹ́. Tún ojú-ìwé náà ṣí lẹ́yìn náà láti rí èsì. | |
| `episodes.subtitle` | Source videos from channels you have authorised. Discovery uses the official YouTube Data API. | Fídíò orísun láti inú àwọn ikanni tí o fún láṣẹ. A ń lo YouTube Data API ti ìjọba YouTube fúnra rẹ̀ láti wá wọn. | |
| `episodes.sampleBanner` | Sample mode: the channels and videos below are invented test data. Nothing here came from YouTube. | Ipò àpẹẹrẹ: àwọn ikanni àti fídíò ìsàlẹ̀ yìí jẹ́ dátà ìdánwò tí a ṣẹ̀dá. Kò sí èyí tó wá láti YouTube. | |
| `episodes.channels` | Authorised source channels | Àwọn ikanni orísun tí a fún láṣẹ | |
| `episodes.noChannels` | No channels yet. Authorise one below. | Kò sí ikanni kankan síbẹ̀. Fún ọ̀kan láṣẹ nísàlẹ̀. | |
| `episodes.addChannel` | Authorise a channel | Fún ikanni kan láṣẹ | |
| `episodes.reference` | Channel link, @handle or ID | Ìjápọ̀ ikanni, @orúkọ tàbí ID | |
| `episodes.referenceHelp` | For example: youtube.com/@channelname | Àpẹẹrẹ: youtube.com/@orukọikanni | |
| `episodes.basis` | Basis for using this channel | Ìdí tí a fi lè lo ikanni yìí | |
| `episodes.basisResearch` | Research only | Fún ìwádìí nìkan | |
| `episodes.basisResearchHelp` | Videos are studied for general business ideas only. They are never translated, adapted or republished. | A ń kẹ́kọ̀ọ́ èrò òwò gbogbogbò láti inú fídíò wọ̀nyí nìkan. A kò ní túmọ̀, ṣàtúnṣe tàbí tún wọn gbé jáde láé. | |
| `episodes.basisLicensed` | Licensed | Pẹ̀lú ìwé àṣẹ | |
| `episodes.basisLicensedHelp` | A licence exists. It must still be verified in Rights management before any adaptation. | Ìwé àṣẹ wà. A ṣì gbọ́dọ̀ fìdí rẹ̀ múlẹ̀ nínú Ìṣàkóso ẹ̀tọ́ kí a tó ṣe àtúnṣe kankan. | |
| `episodes.note` | Authorisation note | Àkọsílẹ̀ àṣẹ | |
| `episodes.noteHelp` | Why you may use this channel: licence reference, permission email, or “research only”. | Ìdí tí o fi lè lo ikanni yìí: nọ́ńbà ìwé àṣẹ, ímeèlì ìyọ̀ǹda, tàbí “fún ìwádìí nìkan”. | |
| `episodes.add` | Authorise channel | Fún ikanni láṣẹ | |
| `episodes.adding` | Authorising… | Ó ń fún un láṣẹ… | |
| `episodes.added` | Channel authorised. | A ti fún ikanni náà láṣẹ. | |
| `episodes.failed` | Could not authorise the channel: {msg} | A kò lè fún ikanni náà láṣẹ: {msg} | |
| `episodes.scan` | Scan for new videos | Wá fídíò tuntun | |
| `episodes.pause` | Pause | Dá a dúró | |
| `episodes.resume` | Resume | Tẹ̀síwájú | |
| `episodes.paused` | Paused | A ti dá a dúró | |
| `episodes.videoCount` | {n} videos | Fídíò {n} | |
| `episodes.lastScanned` | Last scanned {when} | Ìgbà ìkẹyìn tí a wá: {when} | |
| `episodes.neverScanned` | Not scanned yet | A kò tíì wá a rí | |
| `episodes.sample` | SAMPLE | ÀPẸẸRẸ | |
| `episodes.list` | Episodes | Àwọn ìpín | |
| `episodes.search` | Search titles | Wá àkọlé | |
| `episodes.allStatuses` | All statuses | Gbogbo ipò | |
| `episodes.status.discovered` | Discovered | A ti rí i | |
| `episodes.status.researched` | Researched | A ti ṣèwádìí | |
| `episodes.status.archived` | Archived | A ti fi pamọ́ | |
| `episodes.filter` | Filter | Ṣàsẹ́ | |
| `episodes.colTitle` | Title | Àkọlé | |
| `episodes.colChannel` | Channel | Ikanni | |
| `episodes.colPublished` | Published | Ọjọ́ ìgbéjáde | |
| `episodes.colLength` | Length | Gígùn | |
| `episodes.colTranscript` | Transcript | Àkọsílẹ̀ ọ̀rọ̀ | |
| `episodes.colStatus` | Status | Ipò | |
| `episodes.possibleDuplicate` | Possible re-upload | Ó lè jẹ́ àtúngbéjáde | |
| `episodes.none` | No episodes match. | Kò sí ìpín tó bá a mu. | |
| `episodes.showing` | Showing {from}–{to} of {total} | À ń fi {from}–{to} hàn nínú {total} | |
| `episodes.prev` | Previous | Ti tẹ́lẹ̀ | |
| `episodes.next` | Next | Tó kàn | |
| `episodes.back` | Back to episodes | Padà sí àwọn ìpín | |
| `episodes.open` | Open the source video | Ṣí fídíò orísun | |
| `episodes.description` | Description | Àlàyé | |
| `episodes.noDescription` | No description. | Kò sí àlàyé. | |
| `episodes.captions` | Captions exist on YouTube (not downloaded: that needs the owner's consent). | Àkọlé ìsàlẹ̀ wà lórí YouTube (a kò gbà á sílẹ̀: ìyẹn nílò àṣẹ olóhun). | |
| `episodes.transcript` | Transcript | Àkọsílẹ̀ ọ̀rọ̀ | |
| `episodes.transcriptNone` | No transcript held. Research will use the title and description only. | Kò sí àkọsílẹ̀ ọ̀rọ̀. Ìwádìí yóò lo àkọlé àti àlàyé nìkan. | |
| `episodes.transcriptRule` | Only add a transcript you are permitted to hold: one supplied by the rights holder, your own notes, or one downloaded with the owner's consent. Transcripts are never scraped. | Fi àkọsílẹ̀ ọ̀rọ̀ tí o ní àṣẹ láti ní nìkan kún un: èyí tí olóhun ẹ̀tọ́ fúnni, àkọsílẹ̀ tìrẹ, tàbí èyí tí a gbà pẹ̀lú àṣẹ olóhun. A kò ní jí àkọsílẹ̀ ọ̀rọ̀ láé. | |
| `episodes.transcriptHeld` | {words} words · {source} · added by {who} | Ọ̀rọ̀ {words} · {source} · {who} ló fi kún un | |
| `episodes.permission` | Permission | Àṣẹ | |
| `episodes.text` | Transcript text | Àkọsílẹ̀ ọ̀rọ̀ | |
| `episodes.language` | Language | Èdè | |
| `episodes.source` | Where it came from | Ibi tí ó ti wá | |
| `episodes.sources.licensor_provided` | Supplied by the rights holder | Olóhun ẹ̀tọ́ ló fúnni | |
| `episodes.sources.owner_entered` | My own notes or material | Àkọsílẹ̀ tàbí ohun tèmi | |
| `episodes.sources.official_api` | Platform API, with the owner's consent | API ìkànnì, pẹ̀lú àṣẹ olóhun | |
| `episodes.permissionRef` | Permission reference | Ẹ̀rí àṣẹ | |
| `episodes.permissionHelp` | Licence number, date of the permission email, or “my own notes”. | Nọ́ńbà ìwé àṣẹ, ọjọ́ ímeèlì ìyọ̀ǹda, tàbí “àkọsílẹ̀ tèmi”. | |
| `episodes.saveTranscript` | Save transcript | Fi àkọsílẹ̀ pamọ́ | |
| `episodes.transcriptSaved` | Transcript saved. | A ti fi àkọsílẹ̀ ọ̀rọ̀ pamọ́. | |
| `episodes.research` | Research | Ìwádìí | |
| `episodes.researchHelp` | The language model studies this episode and proposes topics for original Yoruba lessons. | Ẹ̀rọ èdè yóò kẹ́kọ̀ọ́ ìpín yìí, yóò sì dábàá kókó fún ẹ̀kọ́ Yorùbá tuntun. | |
| `episodes.runResearch` | Generate research report | Ṣe ìròyìn ìwádìí | |
| `episodes.noReports` | No research yet. | Kò sí ìwádìí síbẹ̀. | |
| `research.subtitle` | Turn source material and your own ideas into topics for original Yoruba lessons. You decide which topics go forward. | Sọ ohun orísun àti èrò tìrẹ di kókó fún ẹ̀kọ́ Yorùbá tuntun. Ìwọ ni yóò pinnu kókó tí yóò tẹ̀síwájú. | |
| `research.newSubject` | Research a subject | Ṣèwádìí lórí kókó kan | |
| `research.subjectHelp` | Independent research needs no source video, for example “Cash flow for market traders”. | Ìwádìí òmìnira kò nílò fídíò orísun, fún àpẹẹrẹ “Ìṣàn owó fún àwọn oníṣòwò ọjà”. | |
| `research.subject` | Subject | Kókó | |
| `research.start` | Start research | Bẹ̀rẹ̀ ìwádìí | |
| `research.queue` | Topics awaiting your decision | Àwọn kókó tó ń dúró de ìpinnu rẹ | |
| `research.queueEmpty` | No topics are waiting. Generate research to get proposals. | Kò sí kókó tó ń dúró. Ṣe ìwádìí láti rí àbá. | |
| `research.approvedTitle` | Approved topics | Àwọn kókó tí a fọwọ́ sí | |
| `research.approvedEmpty` | No approved topics yet. | Kò sí kókó tí a fọwọ́ sí síbẹ̀. | |
| `research.approve` | Approve | Fọwọ́ sí i | |
| `research.reject` | Reject | Kọ̀ ọ́ | |
| `research.decisionNote` | Note (optional) | Àkíyèsí (kò pọn dandan) | |
| `research.audience` | Audience | Àwọn olùgbọ́ | |
| `research.angle` | Lesson angle | Ọ̀nà ẹ̀kọ́ | |
| `research.fromReport` | From report: {subject} | Láti inú ìròyìn: {subject} | |
| `research.reports` | Research reports | Àwọn ìròyìn ìwádìí | |
| `research.reportsEmpty` | No reports yet. | Kò sí ìròyìn síbẹ̀. | |
| `research.reportStatus.pending` | In progress | Ó ń lọ lọ́wọ́ | |
| `research.reportStatus.completed` | Completed | Ó ti parí | |
| `research.reportStatus.failed` | Failed | Kò yọrí | |
| `research.reportStatus.blocked` | Blocked | A dí i lọ́nà | |
| `research.cost` | Cost | Owó | |
| `research.model` | Model | Ẹ̀rọ | |
| `research.tokens` | Tokens | Tókìnì | |
| `research.overlapOk` | Originality check passed. Longest run copied from the source: {n} words. | Àyẹ̀wò àìdàkọ yege. Ọ̀rọ̀ tó gùn jùlọ tí a dà kọ láti orísun: ọ̀rọ̀ {n}. | |
| `research.overlapBad` | Copied wording detected ({n} words in a row). Topics from this report cannot be approved. Run the research again. | A rí ọ̀rọ̀ tí a dà kọ (ọ̀rọ̀ {n} léraléra). A kò lè fọwọ́ sí kókó láti inú ìròyìn yìí. Tún ìwádìí náà ṣe. | |
| `research.summary` | Summary | Àkópọ̀ | |
| `research.concepts` | Key concepts | Àwọn èrò pàtàkì | |
| `research.nigeria` | Nigerian context | Àyíká Nàìjíríà | |
| `research.topics` | Proposed topics | Àwọn kókó tí a dábàá | |
| `research.cautions` | Cautions | Àwọn ìkìlọ̀ | |
| `research.noTranscript` | Based on the title and description only (no transcript). | Ó dá lórí àkọlé àti àlàyé nìkan (kò sí àkọsílẹ̀ ọ̀rọ̀). | |
| `research.withTranscript` | Based on the permitted transcript. | Ó dá lórí àkọsílẹ̀ ọ̀rọ̀ tí a ní àṣẹ fún. | |
| `research.topicStatus.proposed` | Awaiting decision | Ó ń dúró de ìpinnu | |
| `research.topicStatus.approved` | Approved | A fọwọ́ sí i | |
| `research.topicStatus.rejected` | Rejected | A kọ̀ ọ́ | |
| `research.decidedBy` | {status} by {who} | {status} láti ọwọ́ {who} | |
| `research.decisionFailed` | The decision could not be saved: {msg} | A kò lè fi ìpinnu náà pamọ́: {msg} | |
| `research.sampleNote` | Sample output: written offline without a language model, to test the workflow only. | Èsì àpẹẹrẹ: a kọ ọ́ láìlo ẹ̀rọ èdè, fún ìdánwò ètò iṣẹ́ nìkan. | |
| `research.problem` | Problem | Ìṣòro | |
| `research.back` | Back to research | Padà sí ìwádìí | |
| `rights.subtitle` | Licences for adapting source material. A licensed adaptation is blocked unless a verified, current licence grants every right it needs. | Ìwé àṣẹ fún ṣíṣe àtúnṣe ohun orísun. A ó dí àtúnṣe tí ó nílò ìwé àṣẹ lọ́nà àyàfi tí ìwé àṣẹ tí a fìdí rẹ̀ múlẹ̀, tí kò sì tíì parí, bá fúnni ní gbogbo ẹ̀tọ́ tí ó nílò. | |
| `rights.disclaimer` | This system records and enforces the licence details you enter. It does not judge whether a contract is valid. Have a lawyer review any licence before you rely on it. | Sístẹ́mù yìí ń kọ àlàyé ìwé àṣẹ tí o tẹ̀ sí i sílẹ̀, ó sì ń mú un ṣẹ. Kò lè sọ bóyá àdéhùn kan bófin mu. Jẹ́ kí agbẹjọ́rò ṣàyẹ̀wò ìwé àṣẹ kí o tó gbẹ́kẹ̀lé e. | |
| `rights.summary.active` | Active | Ó ń ṣiṣẹ́ | |
| `rights.summary.draft` | Drafts | Àkọ́pamọ́ | |
| `rights.summary.expiring_soon` | Expiring within 30 days | Yóò parí láàrin ọjọ́ 30 | |
| `rights.summary.expired` | Expired | Ó ti parí | |
| `rights.summary.revoked` | Revoked | A ti fagi lé e | |
| `rights.licences` | Licences | Àwọn ìwé àṣẹ | |
| `rights.none` | No licences recorded. | Kò sí ìwé àṣẹ tí a kọ sílẹ̀. | |
| `rights.newLicence` | Record a licence | Kọ ìwé àṣẹ sílẹ̀ | |
| `rights.colReference` | Reference | Nọ́ńbà | |
| `rights.colLicensor` | Licensor | Olùfúnni-láṣẹ | |
| `rights.colScope` | Covers | Ohun tí ó bò | |
| `rights.colRights` | Rights | Àwọn ẹ̀tọ́ | |
| `rights.colPlatforms` | Platforms | Àwọn ìkànnì | |
| `rights.colExpires` | Expires | Ọjọ́ ìparí | |
| `rights.colState` | State | Ipò | |
| `rights.state.draft` | Draft (not verified) | Àkọ́pamọ́ (a kò tíì fìdí rẹ̀ múlẹ̀) | |
| `rights.state.active` | Active | Ó ń ṣiṣẹ́ | |
| `rights.state.expired` | Expired | Ó ti parí | |
| `rights.state.revoked` | Revoked | A ti fagi lé e | |
| `rights.state.not_yet_effective` | Not yet in force | Kò tíì bẹ̀rẹ̀ | |
| `rights.wholeChannel` | Whole channel: {channel} | Gbogbo ikanni: {channel} | |
| `rights.episodesCount` | {n} episodes | Ìpín {n} | |
| `rights.noScope` | Nothing yet | Kò sí nǹkan síbẹ̀ | |
| `rights.rightNames.translation` | Translation | Ìtumọ̀ | |
| `rights.rightNames.adaptation` | Adaptation | Àtúnṣe | |
| `rights.rightNames.commercial` | Commercial use | Lílò fún òwò | |
| `rights.rightNames.distribution` | Distribution | Ìpínkiri | |
| `rights.grant.granted` | Granted | A fún wa | |
| `rights.grant.not_granted` | Not granted | A kò fún wa | |
| `rights.grant.unclear` | Unclear | Kò ṣe kedere | |
| `rights.platformNames.youtube` | YouTube | YouTube | |
| `rights.platformNames.facebook` | Facebook | Facebook | |
| `rights.platformNames.instagram` | Instagram | Instagram | |
| `rights.platformNames.tiktok` | TikTok | TikTok | |
| `rights.form.details` | Licence details | Àlàyé ìwé àṣẹ | |
| `rights.form.reference` | Licence reference | Nọ́ńbà ìwé àṣẹ | |
| `rights.form.licensor` | Licensor (rights holder) | Olùfúnni-láṣẹ (olóhun ẹ̀tọ́) | |
| `rights.form.contact` | Licensor contact | Ọ̀nà láti kàn sí olùfúnni-láṣẹ | |
| `rights.form.description` | Notes | Àkíyèsí | |
| `rights.form.signedOn` | Signed on | Ọjọ́ tí a fọwọ́ sí i | |
| `rights.form.effectiveFrom` | In force from | Yóò bẹ̀rẹ̀ láti | |
| `rights.form.expiresAt` | Expires on | Yóò parí ní | |
| `rights.form.rights` | Rights granted | Àwọn ẹ̀tọ́ tí a fúnni | |
| `rights.form.rightsHelp` | Choose “Unclear” if the document does not say plainly. Unclear always blocks. | Yan “Kò ṣe kedere” bí ìwé náà kò bá sọ ọ́ ní gbangba. “Kò ṣe kedere” máa ń dí i lọ́nà nígbà gbogbo. | |
| `rights.form.platforms` | Permitted platforms | Àwọn ìkànnì tí a gbà láàyè | |
| `rights.form.languages` | Permitted languages (codes, comma-separated) | Àwọn èdè tí a gbà láàyè (kóòdù, pẹ̀lú kọ́mà láàrin wọn) | |
| `rights.form.territory` | Territory | Agbègbè | |
| `rights.form.attributionRequired` | The licensor must be credited | A gbọ́dọ̀ dárúkọ olùfúnni-láṣẹ | |
| `rights.form.attributionText` | Credit text | Ọ̀rọ̀ ìdárúkọ | |
| `rights.form.save` | Save licence | Fi ìwé àṣẹ pamọ́ | |
| `rights.form.saved` | Saved. | A ti fi pamọ́. | |
| `rights.form.editResets` | Changing a verified licence returns it to draft until you verify it again. | Yíyí ìwé àṣẹ tí a ti fìdí rẹ̀ múlẹ̀ padà yóò dá a padà sí àkọ́pamọ́ títí tí o ó fi tún fìdí rẹ̀ múlẹ̀. | |
| `rights.form.failed` | Could not save: {msg} | A kò lè fi pamọ́: {msg} | |
| `rights.document` | Signed document | Ìwé tí a fọwọ́ sí | |
| `rights.noDocument` | No document uploaded. | A kò tíì gbé ìwé kankan sókè. | |
| `rights.upload` | Upload signed licence (PDF, PNG or JPEG, up to 10 MB) | Gbé ìwé àṣẹ tí a fọwọ́ sí sókè (PDF, PNG tàbí JPEG, kò ju 10 MB lọ) | |
| `rights.uploadButton` | Upload | Gbé e sókè | |
| `rights.uploaded` | Document uploaded. | A ti gbé ìwé náà sókè. | |
| `rights.openDocument` | Open document | Ṣí ìwé náà | |
| `rights.fingerprint` | SHA-256 fingerprint | Àmì ìdánimọ̀ SHA-256 | |
| `rights.scope` | What this licence covers | Ohun tí ìwé àṣẹ yìí bò | |
| `rights.scopeChannel` | Whole channel | Gbogbo ikanni | |
| `rights.scopeNoChannel` | No whole channel | Kì í ṣe gbogbo ikanni | |
| `rights.scopeEpisodes` | Specific episodes | Àwọn ìpín pàtó | |
| `rights.saveScope` | Save coverage | Fi ohun tí ó bò pamọ́ | |
| `rights.verification` | Verification | Ìfìdímúlẹ̀ | |
| `rights.problemsTitle` | Before this licence can be verified: | Kí a tó lè fìdí ìwé àṣẹ yìí múlẹ̀: | |
| `rights.problems.document_missing` | Upload the signed document. | Gbé ìwé tí a fọwọ́ sí sókè. | |
| `rights.problems.scope_missing` | Choose the channel or episodes it covers. | Yan ikanni tàbí àwọn ìpín tí ó bò. | |
| `rights.problems.translation_unclear` | Translation rights are marked unclear. | Ẹ̀tọ́ ìtumọ̀ kò ṣe kedere. | |
| `rights.problems.adaptation_unclear` | Adaptation rights are marked unclear. | Ẹ̀tọ́ àtúnṣe kò ṣe kedere. | |
| `rights.problems.commercial_unclear` | Commercial rights are marked unclear. | Ẹ̀tọ́ òwò kò ṣe kedere. | |
| `rights.problems.distribution_unclear` | Distribution rights are marked unclear. | Ẹ̀tọ́ ìpínkiri kò ṣe kedere. | |
| `rights.problems.platforms_missing` | Distribution is granted but no platform is listed. | A fúnni ní ẹ̀tọ́ ìpínkiri ṣùgbọ́n kò sí ìkànnì kankan tí a kọ sílẹ̀. | |
| `rights.problems.languages_missing` | List at least one permitted language. | Kọ èdè kan ó kéré tán tí a gbà láàyè. | |
| `rights.problems.already_expired` | The expiry date has passed. | Ọjọ́ ìparí ti kọjá. | |
| `rights.problems.attribution_text_missing` | Credit is required but no credit text is given. | A gbọ́dọ̀ dárúkọ olùfúnni-láṣẹ ṣùgbọ́n kò sí ọ̀rọ̀ ìdárúkọ. | |
| `rights.confirm` | I have checked every detail above against the signed document. | Mo ti fi gbogbo àlàyé òkè yìí wé ìwé tí a fọwọ́ sí. | |
| `rights.verify` | Verify licence | Fìdí ìwé àṣẹ múlẹ̀ | |
| `rights.verifiedBy` | Verified by {who} on {when} | {who} ló fìdí rẹ̀ múlẹ̀ ní {when} | |
| `rights.revoke` | Revoke licence | Fagi lé ìwé àṣẹ | |
| `rights.revokeReason` | Reason for revoking | Ìdí tí a fi ń fagi lé e | |
| `rights.revokedBy` | Revoked by {who} on {when}: {reason} | {who} ló fagi lé e ní {when}: {reason} | |
| `rights.back` | Back to rights | Padà sí ẹ̀tọ́ | |
| `rights.check` | Check rights for an episode | Ṣàyẹ̀wò ẹ̀tọ́ fún ìpín kan | |
| `rights.checkHelp` | Every check is recorded in the audit trail. | A ń kọ àyẹ̀wò kọ̀ọ̀kan sínú àkọsílẹ̀ àyẹ̀wò. | |
| `rights.episode` | Episode | Ìpín | |
| `rights.purpose` | Use | Ìlò | |
| `rights.purposes.adaptation` | Adapt into Yoruba | Ṣe àtúnṣe sí Yorùbá | |
| `rights.purposes.publish` | Publish | Tẹ̀ ẹ́ jáde | |
| `rights.platform` | Platform | Ìkànnì | |
| `rights.runCheck` | Check | Ṣàyẹ̀wò | |
| `rights.allowed` | Allowed. Licence {licence} covers this use. | A gbà á láàyè. Ìwé àṣẹ {licence} bo ìlò yìí. | |
| `rights.denied` | Not allowed: | A kò gbà á láàyè: | |
| `rights.reasons.no_licence` | No licence covers this episode. | Kò sí ìwé àṣẹ tí ó bo ìpín yìí. | |
| `rights.reasons.research_only_channel` | The channel “{channel}” is authorised for research only. | A fún ikanni “{channel}” láṣẹ fún ìwádìí nìkan. | |
| `rights.reasons.sample_episode` | Sample (test) episodes can never be published. | A kò lè tẹ ìpín àpẹẹrẹ (ìdánwò) jáde láé. | |
| `rights.reasons.licence_draft` | Licence {licence} has not been verified. | A kò tíì fìdí ìwé àṣẹ {licence} múlẹ̀. | |
| `rights.reasons.licence_revoked` | Licence {licence} was revoked. | A ti fagi lé ìwé àṣẹ {licence}. | |
| `rights.reasons.licence_expired` | Licence {licence} has expired. | Ìwé àṣẹ {licence} ti parí. | |
| `rights.reasons.licence_not_yet_effective` | Licence {licence} is not in force yet. | Ìwé àṣẹ {licence} kò tíì bẹ̀rẹ̀. | |
| `rights.reasons.right_missing` | Licence {licence}: {right} is “{state}”. | Ìwé àṣẹ {licence}: {right} jẹ́ “{state}”. | |
| `rights.reasons.language_not_permitted` | Licence {licence} does not permit Yoruba. | Ìwé àṣẹ {licence} kò gba Yorùbá láàyè. | |
| `rights.reasons.platform_not_permitted` | Licence {licence} does not permit {platform}. | Ìwé àṣẹ {licence} kò gba {platform} láàyè. | |
| `rights.reasons.platform_unknown` | Choose a platform. | Yan ìkànnì kan. | |
| `rights.reasons.episode_missing` | Episode not found. | A kò rí ìpín náà. | |
| `rights.lastCheck` | Last check: {when} | Àyẹ̀wò ìkẹyìn: {when} | |
| `rights.noChecks` | Not checked yet. | A kò tíì ṣàyẹ̀wò rẹ̀. | |
| `rights.originality` | Originality check | Àyẹ̀wò àìdàkọ | |
| `rights.originalityHelp` | Paste a draft (for example an original lesson script) to see whether any of it repeats source wording. Runs of {n}+ words are flagged. | Lẹ àkọsílẹ̀ kan síbí (fún àpẹẹrẹ àkọsílẹ̀ ẹ̀kọ́ tuntun) láti mọ̀ bóyá ó tún ọ̀rọ̀ orísun sọ. A ó sàmì sí ọ̀rọ̀ {n} tàbí jù bẹ́ẹ̀ lọ tí ó tẹ̀lé ara wọn. | |
| `rights.originalityText` | Draft text | Àkọsílẹ̀ | |
| `rights.runOriginality` | Check originality | Ṣàyẹ̀wò àìdàkọ | |
| `rights.originalityClear` | No copied passages found. | A kò rí ọ̀rọ̀ kankan tí a dà kọ. | |
| `rights.originalityFlagged` | Copied wording found. Rewrite these passages: | A rí ọ̀rọ̀ tí a dà kọ. Tún àwọn apá wọ̀nyí kọ: | |
| `rights.originalityMatch` | {words} words from “{title}” | Ọ̀rọ̀ {words} láti inú “{title}” | |
| `rights.noTranscriptCaveat` | (description only: no transcript held) | (àlàyé nìkan: kò sí àkọsílẹ̀ ọ̀rọ̀) | |
| `rights.changeBasis` | Change basis | Yí ìdí padà | |
| `rights.changeBasisNote` | Reason for the change (e.g. licence reference) | Ìdí fún àyípadà náà (fún àpẹẹrẹ nọ́ńbà ìwé àṣẹ) | |
| `scripts.subtitle` | Yoruba lesson scripts. Every script is checked automatically, then reviewed and approved by a fluent Yoruba speaker before voice production. | Àkọsílẹ̀ ẹ̀kọ́ ní èdè Yorùbá. A ń ṣàyẹ̀wò àkọsílẹ̀ kọ̀ọ̀kan fúnra ẹ̀rọ, lẹ́yìn náà ẹni tó gbọ́ Yorùbá dáadáa yóò ṣàyẹ̀wò rẹ̀, yóò sì fọwọ́ sí i kí a tó gba ohùn sílẹ̀. | |
| `scripts.newScript` | New script | Àkọsílẹ̀ tuntun | |
| `scripts.kind` | Type | Irú | |
| `scripts.kinds.original_lesson` | Original lesson | Ẹ̀kọ́ tuntun | |
| `scripts.kinds.licensed_adaptation` | Licensed adaptation | Àtúnṣe pẹ̀lú ìwé àṣẹ | |
| `scripts.kindHelp.original_lesson` | Written independently from a topic you approved. Checked against source wording. | A kọ ọ́ fúnra wa láti inú kókó tí o fọwọ́ sí. A ó fi wé ọ̀rọ̀ orísun. | |
| `scripts.kindHelp.licensed_adaptation` | Adapted from a source episode. Needs a verified licence and the licensed transcript. | A ṣe àtúnṣe rẹ̀ láti inú ìpín orísun kan. Ó nílò ìwé àṣẹ tí a ti fìdí rẹ̀ múlẹ̀ àti àkọsílẹ̀ ọ̀rọ̀ tí a ní àṣẹ fún. | |
| `scripts.topic` | Approved topic | Kókó tí a fọwọ́ sí | |
| `scripts.noTopics` | No approved topics yet. Approve topics on the Research page first. | Kò sí kókó tí a fọwọ́ sí síbẹ̀. Kọ́kọ́ fọwọ́ sí kókó ní ojú-ìwé Ìwádìí. | |
| `scripts.episode` | Licensed episode (with transcript) | Ìpín pẹ̀lú ìwé àṣẹ (pẹ̀lú àkọsílẹ̀ ọ̀rọ̀) | |
| `scripts.noEpisodes` | No episodes with a transcript yet. | Kò sí ìpín tó ní àkọsílẹ̀ ọ̀rọ̀ síbẹ̀. | |
| `scripts.format` | Format | Ọ̀nà | |
| `scripts.formats.long_form` | Full lesson (16:9) | Ẹ̀kọ́ kíkún (16:9) | |
| `scripts.formats.short` | Short (vertical, under 60 s) | Kúkúrú (ìdúró, kò tó ìṣẹ́jú kan) | |
| `scripts.minutes` | Target length (minutes) | Gígùn tí a fẹ́ (ìṣẹ́jú) | |
| `scripts.create` | Write script | Kọ àkọsílẹ̀ | |
| `scripts.none` | No scripts yet. | Kò sí àkọsílẹ̀ síbẹ̀. | |
| `scripts.all` | All | Gbogbo | |
| `scripts.status.generating` | Being written | À ń kọ ọ́ lọ́wọ́ | |
| `scripts.status.draft` | Draft | Àkọ́pamọ́ | |
| `scripts.status.in_review` | In language review | Ó wà nínú àyẹ̀wò èdè | |
| `scripts.status.changes_requested` | Changes requested | A béèrè àyípadà | |
| `scripts.status.approved` | Approved | A fọwọ́ sí i | |
| `scripts.status.blocked` | Blocked | A dí i lọ́nà | |
| `scripts.status.archived` | Archived | A ti fi pamọ́ | |
| `scripts.colTitle` | Title | Àkọlé | |
| `scripts.colKind` | Type | Irú | |
| `scripts.colScore` | Checks | Àyẹ̀wò | |
| `scripts.colRevision` | Version | Ẹ̀dà | |
| `scripts.colUpdated` | Updated | Ìgbà tí a yí i padà | |
| `scripts.back` | Back to scripts | Padà sí àwọn àkọsílẹ̀ | |
| `scripts.revisionOf` | Version {n} of {total} | Ẹ̀dà {n} nínú {total} | |
| `scripts.viewingOld` | You are viewing version {n}. Editing and review always use the latest version. | Ẹ̀dà {n} lò ń wò. Ẹ̀dà tuntun jùlọ ni a máa ń ṣàtúnṣe sí, tí a sì ń ṣàyẹ̀wò. | |
| `scripts.latest` | Go to latest | Lọ sí tuntun jùlọ | |
| `scripts.generating` | The script is being written. This page updates when it is ready. | À ń kọ àkọsílẹ̀ náà lọ́wọ́. Ojú-ìwé yìí yóò yí padà nígbà tí ó bá parí. | |
| `scripts.blocked` | Stopped: {reason} | Ó dúró: {reason} | |
| `scripts.segments` | Script | Àkọsílẹ̀ | |
| `scripts.colYo` | Yorùbá (narration) | Yorùbá (ohùn) | |
| `scripts.colEn` | English (subtitles) | Gẹ̀ẹ́sì (àkọlé ìsàlẹ̀) | |
| `scripts.colVisual` | On screen | Lójú ìbòjú | |
| `scripts.credit` | Credit required by the licence (cannot be removed) | Ìdárúkọ tí ìwé àṣẹ béèrè (a kò lè yọ ọ́ kúrò) | |
| `scripts.estimated` | About {min} min {sec} s when read aloud (estimate). | Nǹkan bí ìṣẹ́jú {min} àti ìṣẹ́jú-àáyá {sec} tí a bá kà á sókè (àmọ̀rò). | |
| `scripts.edit` | Edit script | Ṣàtúnṣe àkọsílẹ̀ | |
| `scripts.cancel` | Cancel | Fagi lé e | |
| `scripts.titleYo` | Yoruba title | Àkọlé Yorùbá | |
| `scripts.addSegment` | Add segment | Fi apá kan kún un | |
| `scripts.removeSegment` | Remove | Yọ ọ́ kúrò | |
| `scripts.changeNote` | What did you change? | Kí lo yí padà? | |
| `scripts.saveRevision` | Save as new version | Fi pamọ́ gẹ́gẹ́ bí ẹ̀dà tuntun | |
| `scripts.saved` | New version saved. | A ti fi ẹ̀dà tuntun pamọ́. | |
| `scripts.quality` | Automated checks | Àyẹ̀wò ẹ̀rọ | |
| `scripts.score` | Score | Máàkì | |
| `scripts.noIssues` | No problems found by the automated checks. | Àyẹ̀wò ẹ̀rọ kò rí ìṣòro kankan. | |
| `scripts.disclaimer` | Automated checks only. They catch missing marks, English left in the text, missing numbers and similar problems. They cannot judge tone accuracy or naturalness: a fluent Yoruba reviewer must approve every script. | Àyẹ̀wò ẹ̀rọ nìkan ni èyí. Ó ń rí àmì tó sọnù, ọ̀rọ̀ Gẹ̀ẹ́sì tó kù sínú Yorùbá, nọ́ńbà tó sọnù àti irú ìṣòro bẹ́ẹ̀. Kò lè dájọ́ bóyá ohùn tọ̀nà tàbí bóyá èdè náà dùn létí: ẹni tó gbọ́ Yorùbá dáadáa gbọ́dọ̀ fọwọ́ sí gbogbo àkọsílẹ̀. | |
| `scripts.errorsTitle` | Must fix before review | Gbọ́dọ̀ tún un ṣe kí àyẹ̀wò tó bẹ̀rẹ̀ | |
| `scripts.warningsTitle` | Please check | Jọ̀ọ́ ṣàyẹ̀wò | |
| `scripts.issues.no_segments` | The script has no segments. | Àkọsílẹ̀ náà kò ní apá kankan. | |
| `scripts.issues.missing_yoruba` | Segment {segment} has no Yoruba text. | Apá {segment} kò ní ọ̀rọ̀ Yorùbá. | |
| `scripts.issues.missing_english` | Segment {segment} has no English text. | Apá {segment} kò ní ọ̀rọ̀ Gẹ̀ẹ́sì. | |
| `scripts.issues.misplaced_marks` | A tone mark or dot is on a letter that cannot carry it: {words}. | Àmì ohùn tàbí àmì ìsàlẹ̀ wà lórí lẹ́tà tí kò lè gbé e: {words}. | |
| `scripts.issues.tone_marks_missing` | {unmarked_percent}% of words have no tone marks. Tone marks are probably missing. | Ọ̀rọ̀ {unmarked_percent}% kò ní àmì ohùn. Ó ṣeé ṣe kí àmì ohùn ti sọnù. | |
| `scripts.issues.copied_source_wording` | {words} words copied from a source: “{excerpt}”. | Ọ̀rọ̀ {words} tí a dà kọ láti orísun: “{excerpt}”. | |
| `scripts.issues.length_mismatch` | Segment {segment}: Yoruba and English lengths differ a lot. Check nothing is missing. | Apá {segment}: gígùn Yorùbá àti Gẹ̀ẹ́sì yàtọ̀ púpọ̀. Ṣàyẹ̀wò pé kò sí nǹkan tó sọnù. | |
| `scripts.issues.numbers_missing` | Segment {segment}: these figures are in the English but not the Yoruba: {numbers}. | Apá {segment}: àwọn nọ́ńbà yìí wà nínú Gẹ̀ẹ́sì ṣùgbọ́n wọn kò sí nínú Yorùbá: {numbers}. | |
| `scripts.issues.english_in_yoruba` | Segment {segment}: English words in the Yoruba: {words}. | Apá {segment}: ọ̀rọ̀ Gẹ̀ẹ́sì wà nínú Yorùbá: {words}. | |
| `scripts.issues.glossary_term_not_used` | Segment {segment}: the approved word for “{english}” is “{yoruba}”. | Apá {segment}: ọ̀rọ̀ tí a fọwọ́ sí fún “{english}” ni “{yoruba}”. | |
| `scripts.issues.line_below_used` | Uses the vertical line below (e̩) instead of the dot below (ẹ). Saving a new version fixes this. | Ó lo ìlà ìsàlẹ̀ (e̩) dípò àmì ìsàlẹ̀ (ẹ). Fífi ẹ̀dà tuntun pamọ́ yóò tún un ṣe. | |
| `scripts.originality` | Originality: longest run copied from a source is {words} words. | Àìdàkọ: ọ̀rọ̀ tó gùn jùlọ tí a dà kọ láti orísun jẹ́ ọ̀rọ̀ {words}. | |
| `scripts.sampleNote` | Sample output: written offline without a language model, to test the workflow only. | Èsì àpẹẹrẹ: a kọ ọ́ láìlo ẹ̀rọ èdè, fún ìdánwò ètò iṣẹ́ nìkan. | |
| `scripts.actions` | Next step | Ìgbésẹ̀ tó kàn | |
| `scripts.submit` | Send for language review | Fi ránṣẹ́ fún àyẹ̀wò èdè | |
| `scripts.submitHelp` | A fluent Yoruba reviewer must check and approve the latest version. | Ẹni tó gbọ́ Yorùbá dáadáa gbọ́dọ̀ ṣàyẹ̀wò ẹ̀dà tuntun jùlọ, kí ó sì fọwọ́ sí i. | |
| `scripts.review` | Language review | Àyẹ̀wò èdè | |
| `scripts.checklist.tone_marks` | Every word is correctly toned and dotted | Gbogbo ọ̀rọ̀ ní àmì ohùn àti àmì ìsàlẹ̀ tó tọ̀nà | |
| `scripts.checklist.natural_phrasing` | It sounds like natural Nigerian Yoruba, not translated English | Ó dún bí Yorùbá Nàìjíríà gidi, kì í ṣe Gẹ̀ẹ́sì tí a túmọ̀ | |
| `scripts.checklist.terminology` | Business terms are correct and consistent | Àwọn ọ̀rọ̀ òwò tọ̀nà, wọ́n sì dọ́gba jákèjádò | |
| `scripts.checklist.numbers_and_naira` | Figures and naira amounts are correct and read naturally | Àwọn nọ́ńbà àti iye owó náírà tọ̀nà, wọ́n sì ṣeé kà dáadáa | |
| `scripts.checklist.cultural_fit` | Examples and tone suit the audience | Àwọn àpẹẹrẹ àti ohùn bá àwọn olùgbọ́ mu | |
| `scripts.checklist.source_handling` | Original: nothing copied. Adaptation: faithful to the source and credited. | Ẹ̀kọ́ tuntun: kò sí ohun tí a dà kọ. Àtúnṣe: ó bá orísun mu, a sì dárúkọ wọn. | |
| `scripts.comments` | Comments | Àkíyèsí | |
| `scripts.approve` | Approve this version | Fọwọ́ sí ẹ̀dà yìí | |
| `scripts.requestChanges` | Request changes | Béèrè àyípadà | |
| `scripts.reviseTitle` | Ask the writer for changes | Ní kí òǹkọ̀wé ṣe àyípadà | |
| `scripts.reviseHelp` | The language model writes a new version following your instructions. It still needs review. | Ẹ̀rọ èdè yóò kọ ẹ̀dà tuntun gẹ́gẹ́ bí ìtọ́sọ́nà rẹ. Ó ṣì nílò àyẹ̀wò. | |
| `scripts.instructions` | Instructions | Ìtọ́sọ́nà | |
| `scripts.reviseButton` | Write new version | Kọ ẹ̀dà tuntun | |
| `scripts.approvedBy` | Version {n} approved by {who} on {when}. | {who} ló fọwọ́ sí ẹ̀dà {n} ní {when}. | |
| `scripts.readyForVoice` | Ready for voice production (Phase 6). | Ó ti ṣe tán fún gbígba ohùn sílẹ̀ (Ìpele 6). | |
| `scripts.exports` | Downloads | Àwọn ohun tí a lè gbà sílẹ̀ | |
| `scripts.srtYo` | Yoruba subtitles (.srt) | Àkọlé ìsàlẹ̀ Yorùbá (.srt) | |
| `scripts.srtEn` | English subtitles (.srt) | Àkọlé ìsàlẹ̀ Gẹ̀ẹ́sì (.srt) | |
| `scripts.textFile` | Script text (.txt) | Àkọsílẹ̀ (.txt) | |
| `scripts.srtNote` | Timing is estimated until the voice is recorded. It is then re-timed to the real audio. | Àkókò jẹ́ àmọ̀rò títí tí a ó fi gba ohùn sílẹ̀. Lẹ́yìn náà a ó tún un ṣe sí ohùn gidi. | |
| `scripts.revisions` | Versions | Àwọn ẹ̀dà | |
| `scripts.origins.generated` | Written by model | Ẹ̀rọ ló kọ ọ́ | |
| `scripts.origins.revised` | Revised by model | Ẹ̀rọ ló tún un kọ | |
| `scripts.origins.human_edit` | Edited by a person | Ènìyàn ló ṣàtúnṣe rẹ̀ | |
| `scripts.reviews` | Review history | Ìtàn àyẹ̀wò | |
| `scripts.decisions.approved` | Approved | A fọwọ́ sí i | |
| `scripts.decisions.changes_requested` | Changes requested | A béèrè àyípadà | |
| `scripts.noReviews` | No reviews yet. | Kò sí àyẹ̀wò síbẹ̀. | |
| `scripts.archive` | Archive | Fi pamọ́ | |
| `scripts.failed` | Could not complete: {msg} | A kò lè parí rẹ̀: {msg} | |
| `scripts.dictionaryLink` | Vocabulary & pronunciation | Ọ̀rọ̀ àti ìpè | |
| `dictionary.title` | Vocabulary & pronunciation | Ọ̀rọ̀ àti ìpè | |
| `dictionary.subtitle` | Approved Yoruba business terms are given to the script writer. Approved pronunciations are given to the voice. Every new or changed entry must be approved by a Yoruba reviewer first. | A ń fún òǹkọ̀wé ní àwọn ọ̀rọ̀ òwò Yorùbá tí a fọwọ́ sí. A ń fún ohùn ní àwọn ìpè tí a fọwọ́ sí. Ẹni tó ń ṣàyẹ̀wò Yorùbá gbọ́dọ̀ kọ́kọ́ fọwọ́ sí gbogbo ọ̀rọ̀ tuntun tàbí èyí tí a yí padà. | |
| `dictionary.glossary` | Business vocabulary | Ọ̀rọ̀ òwò | |
| `dictionary.english` | English term | Ọ̀rọ̀ Gẹ̀ẹ́sì | |
| `dictionary.yoruba` | Yoruba term | Ọ̀rọ̀ Yorùbá | |
| `dictionary.notes` | Notes | Àkíyèsí | |
| `dictionary.add` | Add | Fi kún un | |
| `dictionary.approve` | Approve | Fọwọ́ sí i | |
| `dictionary.remove` | Delete | Pa á rẹ́ | |
| `dictionary.proposed` | Needs approval | Ó nílò ìfọwọ́sí | |
| `dictionary.approved` | Approved | A fọwọ́ sí i | |
| `dictionary.pronunciation` | Pronunciation dictionary | Ìwé atúmọ̀ ìpè | |
| `dictionary.written` | Written as | Bí a ṣe ń kọ ọ́ | |
| `dictionary.spoken` | Say it as | Bí a ṣe ń pè é | |
| `dictionary.category` | Kind | Irú | |
| `dictionary.categories.term` | Term | Ọ̀rọ̀ | |
| `dictionary.categories.name` | Name | Orúkọ | |
| `dictionary.categories.brand` | Brand | Orúkọ ọjà | |
| `dictionary.categories.loanword` | Loanword | Ọ̀rọ̀ àyálò | |
| `dictionary.categories.number` | Number | Nọ́ńbà | |
| `dictionary.exportPls` | Download lexicon (.pls) for the voice service | Gba ìwé atúmọ̀ (.pls) sílẹ̀ fún iṣẹ́ ohùn | |
| `dictionary.empty` | Nothing yet. | Kò sí nǹkan síbẹ̀. | |
| `account.title` | My account | Àkáǹtì mi | |
| `account.changePassword` | Change password | Yí ọ̀rọ̀ aṣínà padà | |
| `account.current` | Current password | Ọ̀rọ̀ aṣínà ti ìsinsìnyí | |
| `account.next` | New password (at least 12 characters, mixed case and a digit) | Ọ̀rọ̀ aṣínà tuntun (ó kéré tán lẹ́tà 12, lẹ́tà ńlá àti kékeré, àti nọ́ńbà kan) | |
| `account.save` | Change password | Yí ọ̀rọ̀ aṣínà padà | |
| `account.done` | Password changed. Other devices have been signed out. | A ti yí ọ̀rọ̀ aṣínà padà. A ti mú àwọn ẹ̀rọ mìíràn jáde. | |
| `account.menu` | My account | Àkáǹtì mi | |
| `team.title` | Language reviewers | Àwọn olùyẹ̀wò èdè | |
| `team.help` | Reviewers can sign in to check and approve Yoruba scripts and vocabulary. They cannot see anything else. | Àwọn olùyẹ̀wò lè wọlé láti ṣàyẹ̀wò àti fọwọ́ sí àkọsílẹ̀ Yorùbá àti ọ̀rọ̀. Wọn kò lè rí nǹkan mìíràn. | |
| `team.name` | Name | Orúkọ | |
| `team.email` | Email | Ímeèlì | |
| `team.add` | Add reviewer | Fi olùyẹ̀wò kún un | |
| `team.tempPassword` | Temporary password for {email}: {password} (shown once; share it privately and ask them to change it). | Ọ̀rọ̀ aṣínà fún ìgbà díẹ̀ fún {email}: {password} (a ó fi hàn lẹ́ẹ̀kan ṣoṣo; fi ránṣẹ́ sí wọn ní ìkọ̀kọ̀, kí o sì ní kí wọ́n yí i padà). | |
| `team.active` | Active | Ó ń ṣiṣẹ́ | |
| `team.inactive` | Deactivated | A ti dá a dúró | |
| `team.deactivate` | Deactivate | Dá a dúró | |
| `team.reactivate` | Reactivate | Tún un ṣí | |
| `team.none` | No reviewers yet. | Kò sí olùyẹ̀wò síbẹ̀. | |
| `forbidden.title` | Not available | Kò sí fún ọ | |
| `forbidden.body` | This page is for the academy owner. Your account can work on Yoruba scripts. | Ojú-ìwé yìí wà fún ọ̀gá ilé-ẹ̀kọ́ nìkan. Àkáǹtì rẹ lè ṣiṣẹ́ lórí àkọsílẹ̀ Yorùbá. | |
| `forbidden.go` | Go to Yoruba scripts | Lọ sí àkọsílẹ̀ Yorùbá | |
| `settings.title` | System settings | Ètò sístẹ́mù | |
| `settings.subtitle` | Limits and rules the platform must obey. Every change is recorded in the audit trail. | Àwọn òpin àti òfin tí sístẹ́mù gbọ́dọ̀ tẹ̀lé. A ń kọ gbogbo àyípadà sínú àkọsílẹ̀ àyẹ̀wò. | |
| `settings.categories.budget` | Budget and cost control | Ìṣúná àti ìṣàkóso ìnáwó | |
| `settings.categories.storage` | Storage | Ibi ìpamọ́ | |
| `settings.categories.publishing` | Publishing | Ìtẹ̀jáde | |
| `settings.categories.production` | Production | Ìṣẹ̀dá | |
| `settings.categories.discovery` | Discovery | Ìwádìí fídíò | |
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
| `settings.labels.discovery.max_videos_per_scan` | Videos per channel scan | Fídíò fún ìwádìí ikanni kọ̀ọ̀kan | |
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
| `settings.help.discovery.max_videos_per_scan` | Most videos recorded per channel scan. Each 50 videos use about 2 of YouTube's 10,000 free daily quota units. | Iye fídíò tó pọ̀ jùlọ tí a ó kọ sílẹ̀ nínú ìwádìí ikanni kan. Fídíò 50 kọ̀ọ̀kan ń lo nǹkan bí 2 nínú 10,000 ìpín ọ̀fẹ́ YouTube lójoojúmọ́. | |
| `settings.audit` | Audit trail | Àkọsílẹ̀ àyẹ̀wò | |
| `settings.auditSubtitle` | Every login, change and job, newest first. Entries cannot be edited or deleted. | Gbogbo ìwọlé, àyípadà àti iṣẹ́, láti tuntun jùlọ. A kò lè ṣàtúnṣe tàbí pa àkọsílẹ̀ rẹ́. | |
| `settings.time` | Time | Àkókò | |
| `settings.actor` | By | Ẹni | |
| `settings.action` | Action | Ìgbésẹ̀ | |
| `settings.item` | Item | Nǹkan | |
| `settings.older` | Older entries | Àkọsílẹ̀ àtẹ̀yìnwá | |
| `settings.newest` | Back to newest | Padà sí tuntun jùlọ | |
