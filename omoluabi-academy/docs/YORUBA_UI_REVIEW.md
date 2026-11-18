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
| `overview.checkLevels.ok` | OK | Ó dára | |
| `overview.checkLevels.warn` | Warning | Ìkìlọ̀ | |
| `overview.checkLevels.error` | Problem | Ìṣòro | |
| `overview.checkNames.database` | Database | Ibi ìpamọ́ dátà | |
| `overview.checkNames.queue` | Job queue | Ìlà iṣẹ́ | |
| `overview.checkNames.worker` | Worker and scheduler | Òṣìṣẹ́ àti olùṣètò | |
| `overview.checkNames.budget` | Monthly budget | Ìṣúná oṣù | |
| `overview.checkNames.storage` | Media storage | Ibi ìpamọ́ fídíò | |
| `overview.checkNames.publishing` | Publishing | Ìtẹ̀jáde | |
| `overview.checkNames.jobs` | Background jobs | Iṣẹ́ abẹ́lẹ̀ | |
| `overview.checkNames.uploads` | Uploads | Ìgbéjáde | |
| `overview.checkNames.licences` | Licences | Ìwé àṣẹ | |
| `overview.checkNames.audit` | Audit trail | Àkọsílẹ̀ àyẹ̀wò | |
| `overview.checkNames.account` | Platform account | Àkáǹtì ìkànnì | |
| `overview.allChecksOk` | All checks pass. | Gbogbo àyẹ̀wò ló yege. | |
| `overview.alertsOn` | Problems are also sent to your alert channel. | A tún ń fi àwọn ìṣòro ránṣẹ́ sí ibi ìkìlọ̀ rẹ. | |
| `overview.alertsOff` | Problems are shown here only. Set ALERT_WEBHOOK_URL to receive them in chat or email. | Ibí nìkan ni a ti ń fi ìṣòro hàn. Ṣètò ALERT_WEBHOOK_URL láti gbà wọ́n nínú ìjíròrò tàbí ímeèlì. | |
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
| `voice.subtitle` | One original Nigerian male business educator, with one consistent voice and look. Narration is made only from approved scripts, after a Yoruba speaker has passed a pronunciation test of the exact voice. | Olùkọ́ òwò kan ọmọ Nàìjíríà tí a ṣẹ̀dá, pẹ̀lú ohùn kan àti ìrísí kan náà nígbà gbogbo. A ń gba ohùn sílẹ̀ láti inú àkọsílẹ̀ tí a fọwọ́ sí nìkan, lẹ́yìn tí ẹni tó gbọ́ Yorùbá bá ti yege àyẹ̀wò ìpè ohùn náà. | |
| `voice.presenter` | Presenter | Olùkọ́ | |
| `voice.name` | Presenter name (an original character) | Orúkọ olùkọ́ (ẹ̀dá ìtàn tí a ṣẹ̀dá) | |
| `voice.description` | About the presenter | Nípa olùkọ́ náà | |
| `voice.voiceId` | Voice ID (from your ElevenLabs account) | ID ohùn (láti inú àkáǹtì ElevenLabs rẹ) | |
| `voice.voiceModel` | Voice model (leave blank for the default) | Ẹ̀rọ ohùn (fi sílẹ̀ ní òfo fún àtilẹ̀wá) | |
| `voice.stability` | Stability (0 to 1) | Ìdúróṣinṣin (0 sí 1) | |
| `voice.similarity` | Similarity (0 to 1) | Ìjọra (0 sí 1) | |
| `voice.voiceHelp` | Choose a voice you own or may use commercially. Never clone a real person's voice without their written consent. | Yan ohùn tí ó jẹ́ tìrẹ tàbí tí o ní àṣẹ láti lò fún òwò. Má ṣe ṣe ẹ̀dà ohùn ènìyàn gidi láìsí àṣẹ wọn ní kíkọ. | |
| `voice.declarations` | Declarations | Àwọn ìkéde | |
| `voice.declVoice` | The voice is original or licensed for commercial use, and is not a clone of a real person made without consent. | Ohùn náà jẹ́ tuntun tàbí ó ní àṣẹ fún lílò ní òwò, kì í sì í ṣe ẹ̀dà ohùn ènìyàn gidi tí a ṣe láìsí àṣẹ. | |
| `voice.declPortrait` | The portrait is original (commissioned or AI-generated for us) or licensed, and does not show a real person. | Àwòrán náà jẹ́ tuntun (a sanwó fún un tàbí a fi ẹ̀rọ ṣe é fún wa) tàbí ó ní àṣẹ, kò sì fi ènìyàn gidi hàn. | |
| `voice.declPerson` | The presenter is a fictional character, not an imitation of any real person. | Olùkọ́ náà jẹ́ ẹ̀dá ìtàn, kì í ṣe àfarawé ènìyàn gidi kankan. | |
| `voice.save` | Save presenter | Fi olùkọ́ pamọ́ | |
| `voice.saved` | Saved. | A ti fi pamọ́. | |
| `voice.changeResets` | Changing the voice or portrait cancels approval and needs a new pronunciation test. | Yíyí ohùn tàbí àwòrán padà yóò fagi lé ìfọwọ́sí, yóò sì nílò àyẹ̀wò ìpè tuntun. | |
| `voice.portrait` | Portrait | Àwòrán | |
| `voice.noPortrait` | No portrait yet: videos show the academy's brand card instead of a face. | Kò sí àwòrán síbẹ̀: fídíò yóò fi àmì ilé-ẹ̀kọ́ hàn dípò ojú. | |
| `voice.uploadPortrait` | Upload portrait (PNG or JPEG, up to 5 MB) | Gbé àwòrán sókè (PNG tàbí JPEG, kò ju 5 MB lọ) | |
| `voice.upload` | Upload | Gbé e sókè | |
| `voice.status.draft` | Not approved | A kò tíì fọwọ́ sí i | |
| `voice.status.approved` | Approved | A fọwọ́ sí i | |
| `voice.problems.voice_missing` | Set a voice. | Yan ohùn kan. | |
| `voice.problems.declarations_missing` | Confirm all three declarations. | Fìdí àwọn ìkéde mẹ́tẹ̀ẹ̀ta múlẹ̀. | |
| `voice.problems.pronunciation_test_not_passed` | A Yoruba reviewer must pass a pronunciation test of this exact voice. | Olùyẹ̀wò Yorùbá gbọ́dọ̀ yege àyẹ̀wò ìpè ohùn yìí gan-an. | |
| `voice.approve` | Approve presenter | Fọwọ́ sí olùkọ́ | |
| `voice.approvedBy` | Approved by {who} on {when}. | {who} ló fọwọ́ sí i ní {when}. | |
| `voice.tests` | Pronunciation tests | Àyẹ̀wò ìpè | |
| `voice.testHelp` | A short Yoruba passage with tone pairs (owó, ọwọ́, ọ̀wọ̀), dotted letters, naira amounts and your dictionary terms. A Yoruba reviewer listens and rates it. Narration is blocked until a test of the current voice passes. | Àyọkà Yorùbá kúkúrú pẹ̀lú ọ̀rọ̀ tí ohùn wọn yàtọ̀ (owó, ọwọ́, ọ̀wọ̀), lẹ́tà onídòtí ìsàlẹ̀, iye owó náírà àti àwọn ọ̀rọ̀ inú ìwé atúmọ̀ rẹ. Olùyẹ̀wò Yorùbá yóò gbọ́ ọ, yóò sì fún un ní máàkì. A kò ní gba ohùn sílẹ̀ títí tí àyẹ̀wò ohùn ìsinsìnyí yóò fi yege. | |
| `voice.runTest` | Record a test | Gba àyẹ̀wò sílẹ̀ | |
| `voice.noTests` | No tests yet. | Kò sí àyẹ̀wò síbẹ̀. | |
| `voice.testStatus.generating` | Recording… | À ń gbà á sílẹ̀… | |
| `voice.testStatus.awaiting_review` | Waiting for a reviewer | Ó ń dúró de olùyẹ̀wò | |
| `voice.testStatus.passed` | Passed | Ó yege | |
| `voice.testStatus.failed` | Failed | Kò yege | |
| `voice.testStatus.blocked` | Stopped | Ó dúró | |
| `voice.passage` | What it reads | Ohun tí ó kà | |
| `voice.checks.tones` | Tones are right (owó, ọwọ́ and ọ̀wọ̀ sound different) | Ohùn tọ̀nà (owó, ọwọ́ àti ọ̀wọ̀ dún yàtọ̀) | |
| `voice.checks.dotted_letters` | Ẹ, ọ and ṣ are pronounced correctly | A pe ẹ, ọ àti ṣ dáadáa | |
| `voice.checks.numbers_naira` | Naira amounts and numbers are read correctly in Yoruba | A ka iye owó náírà àti nọ́ńbà dáadáa ní Yorùbá | |
| `voice.checks.terms` | Dictionary terms are said as the dictionary says | A pe àwọn ọ̀rọ̀ inú ìwé atúmọ̀ bí ìwé atúmọ̀ ṣe sọ | |
| `voice.checks.natural_pace` | Pace and rhythm sound natural | Ìyára àti ìlù ọ̀rọ̀ dún bí àdámọ́ | |
| `voice.notes` | Notes (required if anything fails) | Àkíyèsí (ó pọn dandan bí nǹkan kan kò bá yege) | |
| `voice.submitRating` | Save rating | Fi máàkì pamọ́ | |
| `voice.olderVoice` | Recorded with an earlier voice setting | A gbà á sílẹ̀ pẹ̀lú ètò ohùn àtijọ́ | |
| `voice.production` | Narration and presenter assets | Ohùn àti àwọn ohun èlò olùkọ́ | |
| `voice.productionHelp` | Hybrid format (default, low cost): the presenter portrait with gentle motion, the narration, captions re-timed to the voice, and Yoruba slides. A lip-synced avatar needs a licensed provider and avatar minutes in the budget. | Ọ̀nà àdàpọ̀ (àtilẹ̀wá, owó kékeré): àwòrán olùkọ́ pẹ̀lú ìṣísẹ̀ díẹ̀, ohùn, àkọlé ìsàlẹ̀ tí a tún ṣe sí ohùn, àti àwọn ojú-ìwé Yorùbá. Avatar tó ń sọ̀rọ̀ nílò olùpèsè tó ní àṣẹ àti ìṣẹ́jú avatar nínú ìṣúná. | |
| `voice.readyScripts` | Approved scripts | Àkọsílẹ̀ tí a fọwọ́ sí | |
| `voice.noReady` | No approved scripts yet. | Kò sí àkọsílẹ̀ tí a fọwọ́ sí síbẹ̀. | |
| `voice.produce` | Produce narration | Gba ohùn sílẹ̀ | |
| `voice.runs` | Production runs | Àwọn iṣẹ́ ìṣẹ̀dá | |
| `voice.noRuns` | No runs yet. | Kò sí iṣẹ́ síbẹ̀. | |
| `voice.runStatus.queued` | Queued | Ó ń dúró | |
| `voice.runStatus.running` | Producing… | À ń ṣe é… | |
| `voice.runStatus.completed` | Completed | Ó ti parí | |
| `voice.runStatus.failed` | Failed | Kò yọrí | |
| `voice.runStatus.blocked` | Stopped | Ó dúró | |
| `voice.cost` | Cost | Owó | |
| `voice.characters` | {n} characters | Lẹ́tà {n} | |
| `voice.length` | Length | Gígùn | |
| `voice.back` | Back to voice production | Padà sí ìṣẹ̀dá ohùn | |
| `voice.narration` | Narration | Ohùn ìsọ̀rọ̀ | |
| `voice.waveform` | Waveform | Àwòrán ìró | |
| `voice.presenterClip` | Presenter clip (hybrid) | Fídíò olùkọ́ (àdàpọ̀) | |
| `voice.segments` | Segments | Àwọn apá | |
| `voice.slides` | Slides | Àwọn ojú-ìwé | |
| `voice.captions` | Captions (timed to the narration) | Àkọlé ìsàlẹ̀ (tí a ṣe sí ohùn) | |
| `voice.captionsYo` | Yoruba (.srt) | Yorùbá (.srt) | |
| `voice.captionsEn` | English (.srt) | Gẹ̀ẹ́sì (.srt) | |
| `voice.costBreakdown` | Cost of this run | Owó iṣẹ́ yìí | |
| `voice.tts` | Voice | Ohùn | |
| `voice.avatar` | Avatar | Avatar | |
| `voice.total` | Total | Àpapọ̀ | |
| `voice.sampleNote` | Sample audio: a test tone made offline, not a real voice. | Ohùn àpẹẹrẹ: ìró ìdánwò tí a ṣe láìlo ẹ̀rọ ohùn, kì í ṣe ohùn gidi. | |
| `voice.ownerOnly` | Only the owner can change the presenter or start production. | Ọ̀gá nìkan ló lè yí olùkọ́ padà tàbí bẹ̀rẹ̀ ìṣẹ̀dá. | |
| `videos.subtitle` | Finished videos built from completed narration: a 16:9 lesson with intro and outro, a 9:16 vertical cut with burned-in Yoruba captions, thumbnails and caption files. Nothing is published from here: you watch and approve every video first. | Fídíò tí a ti parí láti inú ohùn tí a ti gbà sílẹ̀: ẹ̀kọ́ 16:9 pẹ̀lú ìbẹ̀rẹ̀ àti ìparí, fídíò ìdúró 9:16 pẹ̀lú àkọlé Yorùbá lára rẹ̀, àwòrán àfihàn àti fáìlì àkọlé. A kò ní gbé nǹkan jáde láti ibí: ìwọ ni yóò wo fídíò kọ̀ọ̀kan, tí yóò sì fọwọ́ sí i ní àkọ́kọ́. | |
| `videos.unlock` | {n} of {required} real videos approved by you. Automatic publishing stays off until {required} have been approved. | O ti fọwọ́ sí fídíò gidi {n} nínú {required}. Ìgbéjáde aládàáṣe yóò wà ní pípa títí tí o fi fọwọ́ sí {required}. | |
| `videos.sampleUnlock` | Sample (test-mode) videos are never counted. | A kò ní ka fídíò àpẹẹrẹ (ti ìdánwò) mọ́ ọn. | |
| `videos.ready` | Ready to render | Ó ṣetán fún ṣíṣe fídíò | |
| `videos.readyHelp` | Completed narration runs. Each must pass the educational value gate before it can be rendered. | Iṣẹ́ ohùn tí ó ti parí. Ọ̀kọ̀ọ̀kan gbọ́dọ̀ yege àyẹ̀wò iye ẹ̀kọ́ kí a tó ṣe fídíò rẹ̀. | |
| `videos.noReady` | Nothing ready. Produce narration for an approved script first. | Kò sí èyí tí ó ṣetán. Kọ́kọ́ gba ohùn sílẹ̀ fún àkọsílẹ̀ tí a fọwọ́ sí. | |
| `videos.render` | Render videos | Ṣe fídíò | |
| `videos.gate` | Educational value gate | Àyẹ̀wò iye ẹ̀kọ́ | |
| `videos.gatePassed` | Passes | Ó yege | |
| `videos.gateFailed` | Does not pass | Kò yege | |
| `videos.advisory` | advice only | ìmọ̀ràn nìkan | |
| `videos.notEnforced` | reported, not enforced for sample content | a sọ ọ́, ṣùgbọ́n a kò fi dandan lé e fún àpẹẹrẹ | |
| `videos.checks.run_completed` | Narration run completed | Iṣẹ́ ohùn ti parí | |
| `videos.checks.approved_latest_script` | Latest script version passed language review | Ẹ̀dà àkọsílẹ̀ tuntun ti yege àyẹ̀wò èdè | |
| `videos.checks.automated_quality_clean` | No automated quality errors | Kò sí àṣìṣe nínú àyẹ̀wò ẹ̀rọ | |
| `videos.checks.original_content` | Original content (no copied source text) | Àkóónú tuntun (kò sí ọ̀rọ̀ tí a dà kọ) | |
| `videos.checks.adaptation_rights_valid` | Valid rights for this adaptation | Àṣẹ tó fẹsẹ̀ múlẹ̀ wà fún àtúnṣe yìí | |
| `videos.checks.enough_substance` | Enough teaching substance | Ẹ̀kọ́ tó pọ̀ tó wà nínú rẹ̀ | |
| `videos.checks.practical_action` | Gives the viewer a practical action | Ó fún olùwò ní ìgbésẹ̀ tí ó lè gbé | |
| `videos.checks.local_examples` | Uses Nigerian examples | Ó lo àpẹẹrẹ ti Nàìjíríà | |
| `videos.checks.no_income_promises` | No income promises | Kò ṣe ìlérí owó | |
| `videos.checks.long_resolution` | Lesson is 1920×1080 | Ẹ̀kọ́ jẹ́ 1920×1080 | |
| `videos.checks.long_has_audio` | Lesson has sound | Ẹ̀kọ́ ní ohùn | |
| `videos.checks.long_duration` | Lesson length matches the narration | Gígùn ẹ̀kọ́ bá ohùn mu | |
| `videos.checks.long_captions_within_video` | Lesson captions end within the video | Àkọlé ẹ̀kọ́ parí kí fídíò tó parí | |
| `videos.checks.vertical_resolution` | Vertical video is 1080×1920 | Fídíò ìdúró jẹ́ 1080×1920 | |
| `videos.checks.vertical_has_audio` | Vertical video has sound | Fídíò ìdúró ní ohùn | |
| `videos.checks.vertical_duration` | Vertical length matches its narration | Gígùn fídíò ìdúró bá ohùn rẹ̀ mu | |
| `videos.checks.vertical_captions_within_video` | Vertical captions end within the video | Àkọlé fídíò ìdúró parí kí fídíò tó parí | |
| `videos.list` | Videos | Àwọn fídíò | |
| `videos.noVideos` | No videos yet. | Kò sí fídíò síbẹ̀. | |
| `videos.status.queued` | Queued | Ó ń dúró | |
| `videos.status.rendering` | Rendering… | À ń ṣe é… | |
| `videos.status.awaiting_approval` | Waiting for your approval | Ó ń dúró de ìfọwọ́sí rẹ | |
| `videos.status.approved` | Approved | A fọwọ́ sí i | |
| `videos.status.rejected` | Rejected | A kọ̀ ọ́ | |
| `videos.status.failed` | Failed | Kò yọrí | |
| `videos.status.blocked` | Stopped | Ó dúró | |
| `videos.colTitle` | Lesson | Ẹ̀kọ́ | |
| `videos.colStatus` | Status | Ipò | |
| `videos.colLength` | Length | Gígùn | |
| `videos.colPlatforms` | Fits | Ibi tí ó bá mu | |
| `videos.back` | Back to video production | Padà sí ìṣẹ̀dá fídíò | |
| `videos.long` | Lesson (16:9) | Ẹ̀kọ́ (16:9) | |
| `videos.vertical` | Vertical (9:16) | Fídíò ìdúró (9:16) | |
| `videos.verticalWhole` | The whole lesson. | Gbogbo ẹ̀kọ́ náà. | |
| `videos.verticalTeaser` | The opening of the lesson, ending with a card pointing to the full lesson. | Ìbẹ̀rẹ̀ ẹ̀kọ́ náà, tí ó parí pẹ̀lú káàdì tí ó tọ́ka sí ẹ̀kọ́ kíkún. | |
| `videos.thumbnails` | Thumbnails | Àwòrán àfihàn | |
| `videos.captions` | Caption files | Fáìlì àkọlé | |
| `videos.captionFiles.captions_long_yo` | Lesson · Yoruba (.srt) | Ẹ̀kọ́ · Yorùbá (.srt) | |
| `videos.captionFiles.captions_long_en` | Lesson · English (.srt) | Ẹ̀kọ́ · Gẹ̀ẹ́sì (.srt) | |
| `videos.captionFiles.captions_vertical_yo` | Vertical · Yoruba (.srt) | Fídíò ìdúró · Yorùbá (.srt) | |
| `videos.captionFiles.captions_vertical_en` | Vertical · English (.srt) | Fídíò ìdúró · Gẹ̀ẹ́sì (.srt) | |
| `videos.platforms` | Where it fits | Ibi tí ó bá mu | |
| `videos.platformNames.youtube` | YouTube | YouTube | |
| `videos.platformNames.youtube_short` | YouTube Shorts | YouTube Shorts | |
| `videos.platformNames.instagram_reel` | Instagram Reels | Instagram Reels | |
| `videos.platformNames.facebook_reel` | Facebook Reels | Facebook Reels | |
| `videos.platformNames.tiktok` | TikTok | TikTok | |
| `videos.fits` | Fits | Ó bá a mu | |
| `videos.doesNotFit` | Does not fit | Kò bá a mu | |
| `videos.platformNote` | Platform upload limits change. Review them in docs/PUBLISHING.md. | Òfin ìgbéjáde àwọn ìkànnì máa ń yí padà. Ṣàyẹ̀wò wọn nínú docs/PUBLISHING.md. | |
| `videos.autoChecks` | Automated video checks | Àyẹ̀wò fídíò láti ọwọ́ ẹ̀rọ | |
| `videos.review` | Your review | Àyẹ̀wò rẹ | |
| `videos.reviewHelp` | Watch both videos in full before approving. Approving does not publish anything. | Wo fídíò méjèèjì tán kí o tó fọwọ́ sí i. Fífọwọ́sí kò ní gbé nǹkan jáde. | |
| `videos.checklist.watched_in_full` | I watched the videos in full | Mo ti wo àwọn fídíò náà tán | |
| `videos.checklist.captions_match_voice` | Captions match the voice and the Yoruba marks are correct | Àkọlé bá ohùn mu, àmì ohùn Yorùbá sì tọ̀nà | |
| `videos.checklist.presenter_consistent` | The presenter looks and sounds as approved | Olùkọ́ rí, ó sì dún bí a ṣe fọwọ́ sí i | |
| `videos.checklist.educational_value` | It teaches something useful and original | Ó kọ́ni ní nǹkan tó wúlò tí ó sì jẹ́ tuntun | |
| `videos.checklist.no_income_promises` | It makes no promises of income or quick wealth | Kò ṣe ìlérí owó tàbí ọrọ̀ kíákíá | |
| `videos.checklist.credits_correct` | Credits are correct (or none are needed) | Ìdúpẹ́ orísun tọ̀nà (tàbí kò pọn dandan) | |
| `videos.notes` | Notes (required to reject) | Àkíyèsí (ó pọn dandan láti kọ̀ ọ́) | |
| `videos.approve` | Approve video | Fọwọ́ sí fídíò | |
| `videos.reject` | Reject | Kọ̀ ọ́ | |
| `videos.decided` | {who} decided on {when}. | {who} ló pinnu ní {when}. | |
| `videos.sampleNote` | Sample video: a test tone and placeholder text. It can be reviewed, but never counts toward automatic publishing. | Fídíò àpẹẹrẹ: ìró ìdánwò àti ọ̀rọ̀ àpẹẹrẹ. A lè ṣàyẹ̀wò rẹ̀, ṣùgbọ́n a kò ní kà á mọ́ ìgbéjáde aládàáṣe. | |
| `videos.cost` | Cost of this video | Owó fídíò yìí | |
| `videos.costScript` | Script writing (AI) | Kíkọ àkọsílẹ̀ (AI) | |
| `videos.costVoice` | Voice and presenter | Ohùn àti olùkọ́ | |
| `videos.costRender` | Rendering (local) | Ṣíṣe fídíò (lórí sáfà wa) | |
| `videos.costTotal` | Total | Àpapọ̀ | |
| `accounts.subtitle` | Connect the academy's YouTube channel, Facebook Page, Instagram account and TikTok account. Tokens are stored encrypted and never shown. During the trial, uploads are private, unlisted or drafts. | So ikanni YouTube, ojú-ìwé Facebook, àkáǹtì Instagram àti àkáǹtì TikTok ilé-ẹ̀kọ́ náà pọ̀. A ń tọ́jú àwọn kọ́kọ́rọ́ ìwọlé ní ìpamọ́ àṣírí, a kì í sì í fi wọ́n hàn. Nígbà ìdánwò, ìgbéjáde jẹ́ ti àṣírí, aláìfarahàn tàbí àkọpamọ́. | |
| `accounts.sampleMode` | Test mode: real sign-in is switched off. Sample accounts publish nothing: uploads are only simulated. | Ipò ìdánwò: ìwọlé gidi ti wà ní pípa. Àkáǹtì àpẹẹrẹ kò ní gbé nǹkan jáde: àfarawé ìgbéjáde nìkan ni. | |
| `accounts.providers.google` | YouTube (Google sign-in) | YouTube (ìwọlé Google) | |
| `accounts.providers.meta` | Facebook and Instagram (Meta sign-in) | Facebook àti Instagram (ìwọlé Meta) | |
| `accounts.providers.tiktok` | TikTok | TikTok | |
| `accounts.notes.google` | Uploads are private or unlisted during the trial. Each upload uses about 2,050 of the 10,000 free daily API units. | Ìgbéjáde jẹ́ ti àṣírí tàbí aláìfarahàn nígbà ìdánwò. Ìgbéjáde kọ̀ọ̀kan ń lo nǹkan bí 2,050 nínú 10,000 ìpín API ọ̀fẹ́ lójoojúmọ́. | |
| `accounts.notes.meta` | Facebook Reels are uploaded as drafts during the trial. Instagram has no private or draft upload, so it is used only after automatic publishing is unlocked, you allow public uploads, and public video hosting is set up. | A ń gbé Facebook Reels sókè gẹ́gẹ́ bí àkọpamọ́ nígbà ìdánwò. Instagram kò ní ìgbéjáde àṣírí tàbí àkọpamọ́, nítorí náà a ó lò ó lẹ́yìn tí ìtẹ̀jáde aládàáṣe bá ṣí sílẹ̀ nìkan, tí o gba ìgbéjáde fún gbogbo ènìyàn láàyè, tí a sì ṣètò ibi ìpamọ́ fídíò tí gbogbo ènìyàn lè dé. | |
| `accounts.notes.tiktok` | Videos arrive in your TikTok inbox as drafts. You add the final caption and post them in the TikTok app. | Fídíò yóò dé àpótí TikTok rẹ gẹ́gẹ́ bí àkọpamọ́. Ìwọ ni yóò kọ àkọlé ìkẹyìn, tí yóò sì gbé e jáde nínú áàpù TikTok. | |
| `accounts.connect` | Connect | So pọ̀ | |
| `accounts.connectSample` | Add a sample account | Fi àkáǹtì àpẹẹrẹ kún un | |
| `accounts.disconnect` | Disconnect | Já a kúrò | |
| `accounts.notConfigured` | Not set up yet. Add these to the server's environment (see API_SETUP.md): | A kò tíì ṣètò rẹ̀. Fi àwọn wọ̀nyí kún àyíká sáfà (wo API_SETUP.md): | |
| `accounts.noEncryption` | TOKEN_ENCRYPTION_KEY is not set. Accounts cannot be connected until it is, because tokens are always stored encrypted. | A kò tíì ṣètò TOKEN_ENCRYPTION_KEY. A kò lè so àkáǹtì pọ̀ títí tí a ó fi ṣe é, nítorí pé a máa ń fi kọ́kọ́rọ́ ìwọlé pamọ́ ní àṣírí nígbà gbogbo. | |
| `accounts.redirect` | Redirect URI to register with the platform: | Àdírẹ́sì ìpadàbọ̀ láti forúkọ sílẹ̀ lórí ìkànnì náà: | |
| `accounts.status.connected` | Connected | Ó ti so pọ̀ | |
| `accounts.status.expired` | Reconnect needed | Ó nílò ìsopọ̀ tuntun | |
| `accounts.status.disconnected` | Disconnected | A ti já a kúrò | |
| `accounts.expires` | Access expires {when} | Àṣẹ ìwọlé yóò parí ní {when} | |
| `accounts.noExpiry` | No expiry date | Kò ní ọjọ́ ìparí | |
| `accounts.refreshable` | Renews automatically | Ó ń sọ ara rẹ̀ dọ̀tun fúnra rẹ̀ | |
| `accounts.lastError` | Last problem: {msg} | Ìṣòro tó kẹ́yìn: {msg} | |
| `accounts.noAccounts` | No accounts connected yet. | Kò sí àkáǹtì tí a ti so pọ̀ síbẹ̀. | |
| `accounts.connected` | Connected: {n} account(s). | A ti so àkáǹtì {n} pọ̀. | |
| `accounts.connectFailed` | The connection failed: {msg} | Ìsopọ̀ kò yọrí: {msg} | |
| `accounts.platformNames.youtube` | YouTube | YouTube | |
| `accounts.platformNames.facebook` | Facebook | Facebook | |
| `accounts.platformNames.instagram` | Instagram | Instagram | |
| `accounts.platformNames.tiktok` | TikTok | TikTok | |
| `calendar.subtitle` | Schedule approved videos and follow every upload and its log. Nothing is published publicly during the trial. | Ṣètò ìgbéjáde fídíò tí a fọwọ́ sí, kí o sì máa tẹ̀lé ìgbéjáde kọ̀ọ̀kan àti àkọsílẹ̀ rẹ̀. A kò ní gbé nǹkan jáde fún gbogbo ènìyàn nígbà ìdánwò. | |
| `calendar.paused` | Publishing is paused | Ìtẹ̀jáde ti dúró | |
| `calendar.pauseReason` | Reason: {reason} | Ìdí: {reason} | |
| `calendar.resume` | Resume publishing | Tẹ̀síwájú ìtẹ̀jáde | |
| `calendar.pause` | Pause publishing | Dá ìtẹ̀jáde dúró | |
| `calendar.running` | Publishing is running | Ìtẹ̀jáde ń lọ lọ́wọ́ | |
| `calendar.trial` | Trial period: {n} of {required} real videos approved. Uploads are private, unlisted or drafts. | Àkókò ìdánwò: o ti fọwọ́ sí fídíò gidi {n} nínú {required}. Ìgbéjáde jẹ́ ti àṣírí, aláìfarahàn tàbí àkọpamọ́. | |
| `calendar.unlocked` | Automatic publishing is on. | Ìtẹ̀jáde aládàáṣe ti tàn. | |
| `calendar.publicAllowed` | Public uploads are allowed. | A ti gba ìgbéjáde fún gbogbo ènìyàn láàyè. | |
| `calendar.sentToday` | {n} of {limit} uploads today | Ìgbéjáde {n} nínú {limit} lónìí | |
| `calendar.runNow` | Send due uploads now | Fi ìgbéjáde tí àkókò rẹ̀ tó ránṣẹ́ báyìí | |
| `calendar.queued` | Started. Refresh in a moment to see the result. | A ti bẹ̀rẹ̀. Tún ojú-ìwé ṣe láìpẹ́ láti rí àbájáde. | |
| `calendar.schedule` | Schedule an upload | Ṣètò ìgbéjáde kan | |
| `calendar.video` | Approved video | Fídíò tí a fọwọ́ sí | |
| `calendar.noApproved` | No approved videos yet. Approve a video on the Video production page. | Kò sí fídíò tí a fọwọ́ sí síbẹ̀. Fọwọ́ sí fídíò kan ní ojú-ìwé Ìṣẹ̀dá fídíò. | |
| `calendar.destination` | Destination | Ibi tí yóò lọ | |
| `calendar.account` | Account | Àkáǹtì | |
| `calendar.noAccount` | No connected account for this destination. | Kò sí àkáǹtì tí a so pọ̀ fún ibí. | |
| `calendar.when` | Date and time (Lagos) | Ọjọ́ àti àkókò (Èkó) | |
| `calendar.whenHelp` | Leave empty to upload at the next run (within 5 minutes). | Fi sílẹ̀ ní òfo láti gbé e sókè ní ìgbà tó ń bọ̀ (láàrin ìṣẹ́jú 5). | |
| `calendar.visibility` | Visibility | Ìrísí | |
| `calendar.visibilities.private` | Private | Àṣírí | |
| `calendar.visibilities.unlisted` | Unlisted | Aláìfarahàn | |
| `calendar.visibilities.public` | Public | Gbogbo ènìyàn | |
| `calendar.visibilities.draft` | Draft | Àkọpamọ́ | |
| `calendar.title` | Title | Àkọlé | |
| `calendar.description` | Description | Àpèjúwe | |
| `calendar.scheduleButton` | Schedule | Ṣètò rẹ̀ | |
| `calendar.scheduled` | Scheduled. | A ti ṣètò rẹ̀. | |
| `calendar.unavailable` | Not available now | Kò sí ní àrọ́wọ́tó báyìí | |
| `calendar.doesNotFit` | The video does not fit here | Fídíò náà kò bá ibí mu | |
| `calendar.upcoming` | Upcoming | Èyí tó ń bọ̀ | |
| `calendar.history` | History | Ìtàn | |
| `calendar.noUpcoming` | Nothing scheduled. | Kò sí ohun tí a ṣètò. | |
| `calendar.noHistory` | No uploads yet. | Kò sí ìgbéjáde síbẹ̀. | |
| `calendar.status.scheduled` | Scheduled | A ti ṣètò rẹ̀ | |
| `calendar.status.uploading` | Uploading… | À ń gbé e sókè… | |
| `calendar.status.retrying` | Will retry | A ó tún gbìyànjú | |
| `calendar.status.uploaded` | Uploaded (confirmed) | A ti gbé e sókè (ìkànnì fìdí rẹ̀ múlẹ̀) | |
| `calendar.status.unconfirmed` | Not confirmed | A kò fìdí rẹ̀ múlẹ̀ | |
| `calendar.status.simulated` | Simulated (sample) | Àfarawé (àpẹẹrẹ) | |
| `calendar.status.failed` | Failed | Kò yọrí | |
| `calendar.status.blocked` | Stopped | Ó dúró | |
| `calendar.status.cancelled` | Cancelled | A fagi lé e | |
| `calendar.mode.owner` | scheduled by you | ìwọ lo ṣètò rẹ̀ | |
| `calendar.mode.auto` | scheduled automatically | ètò aládàáṣe | |
| `calendar.cancel` | Cancel | Fagi lé e | |
| `calendar.details` | Details and log | Àlàyé àti àkọsílẹ̀ | |
| `calendar.back` | Back to the calendar | Padà sí kàlẹ́ńdà | |
| `calendar.nextTry` | Next try {when} | Ìgbìyànjú tó kàn: {when} | |
| `calendar.log` | Publishing log | Àkọsílẹ̀ ìtẹ̀jáde | |
| `calendar.attempt` | Attempt {n} | Ìgbìyànjú {n} | |
| `calendar.outcomes.started` | Started | Ó ti bẹ̀rẹ̀ | |
| `calendar.outcomes.confirmed` | Confirmed by the platform | Ìkànnì ti fìdí rẹ̀ múlẹ̀ | |
| `calendar.outcomes.simulated` | Simulated: nothing was sent | Àfarawé: a kò fi nǹkan ránṣẹ́ | |
| `calendar.outcomes.transient_error` | Temporary problem (will retry) | Ìṣòro ìgbà díẹ̀ (a ó tún gbìyànjú) | |
| `calendar.outcomes.permanent_error` | Refused by the platform | Ìkànnì kọ̀ ọ́ | |
| `calendar.outcomes.auth_error` | Account permission refused | Ìkànnì kọ àṣẹ àkáǹtì | |
| `calendar.outcomes.unconfirmed` | Sent, not confirmed | A fi ránṣẹ́, a kò fìdí rẹ̀ múlẹ̀ | |
| `calendar.outcomes.unknown_error` | Interrupted | Ó dáwọ́ dúró láàrin | |
| `calendar.outcomes.blocked` | Stopped by a check | Àyẹ̀wò kan dá a dúró | |
| `calendar.outcomes.deferred` | Moved to tomorrow (daily limit) | A sún un sí ọ̀la (òpin ojoojúmọ́) | |
| `calendar.warnings.captions_not_uploaded` | Captions were not uploaded | A kò gbé àkọlé ìsàlẹ̀ sókè | |
| `calendar.warnings.thumbnail_not_set` | Custom thumbnail not set (needs a verified YouTube channel) | A kò lè fi àwòrán àfihàn tiwa sí i (ó nílò ikanni YouTube tí a ti fìdí rẹ̀ múlẹ̀) | |
| `calendar.unconfirmedHelp` | The platform did not confirm this upload, so it is never sent again automatically. Check the platform and record what you found. | Ìkànnì náà kò fìdí ìgbéjáde yìí múlẹ̀, nítorí náà a kò ní fi ránṣẹ́ mọ́ fúnra wa. Yẹ ìkànnì náà wò, kí o sì kọ ohun tí o rí sílẹ̀. | |
| `calendar.onPlatform` | It is on the platform | Ó wà lórí ìkànnì náà | |
| `calendar.notOnPlatform` | It is not there | Kò sí níbẹ̀ | |
| `calendar.url` | Link (optional) | Ìjápọ̀ (kò pọn dandan) | |
| `calendar.open` | Open on the platform | Ṣí i lórí ìkànnì náà | |
| `money.subtitle` | Affiliate links, digital products, sponsorships and revenue. Only real money is recorded: what you enter, what a payment provider confirms, and what a platform reports (labelled as an estimate). | Ìjápọ̀ ìpolówó, ọjà orí ayélujára, onígbọ̀wọ́ àti owó tó wọlé. Owó gidi nìkan ni a ń kọ sílẹ̀: èyí tí o kọ, èyí tí ilé ìsanwó fìdí rẹ̀ múlẹ̀, àti èyí tí ìkànnì ròyìn (a sàmì sí i gẹ́gẹ́ bí ìṣirò àfojúbù). | |
| `money.youtubeNote` | YouTube monetisation is not assumed. YouTube revenue appears only when YouTube Analytics reports it for your channel. | A kò rò pé YouTube ti fọwọ́ sí ìpawówọlé. Owó YouTube yóò hàn nígbà tí YouTube Analytics bá ròyìn rẹ̀ fún ikanni rẹ nìkan. | |
| `money.payments` | Payments | Ìsanwó | |
| `money.paymentsSample` | Test mode: checkouts are simulated and no money can be taken. | Ipò ìdánwò: àfarawé ni ìsanwó, a kò lè gba owó kankan. | |
| `money.paymentsNotConfigured` | Paystack is not set up. Add PAYSTACK_SECRET_KEY (start with a test key, sk_test_…). | A kò tíì ṣètò Paystack. Fi PAYSTACK_SECRET_KEY kún un (bẹ̀rẹ̀ pẹ̀lú kọ́kọ́rọ́ ìdánwò, sk_test_…). | |
| `money.paymentsTest` | Paystack test key in use: no real money moves. | Kọ́kọ́rọ́ ìdánwò Paystack ni à ń lò: owó gidi kò ní yí ọwọ́ padà. | |
| `money.paymentsLive` | Paystack live key in use: real payments. | Kọ́kọ́rọ́ gidi Paystack ni à ń lò: ìsanwó gidi. | |
| `money.webhook` | Webhook address to register with Paystack: | Àdírẹ́sì ìfitónilétí láti forúkọ sílẹ̀ lórí Paystack: | |
| `money.revenue` | Revenue | Owó tó wọlé | |
| `money.recordRevenue` | Record revenue | Kọ owó tó wọlé sílẹ̀ | |
| `money.source` | Source | Orísun | |
| `money.sources.youtube` | YouTube | YouTube | |
| `money.sources.affiliate` | Affiliate | Ìpolówó alájọṣe | |
| `money.sources.product` | Product | Ọjà | |
| `money.sources.sponsorship` | Sponsorship | Onígbọ̀wọ́ | |
| `money.sources.other` | Other | Òmíràn | |
| `money.amount` | Amount | Iye owó | |
| `money.currency` | Currency | Owó wo | |
| `money.date` | Date received | Ọjọ́ tí ó wọlé | |
| `money.descriptionLabel` | Description | Àpèjúwe | |
| `money.reference` | Reference (invoice or payout ID, prevents double entry) | Nọ́ńbà ìtọ́kasí (ìwé owó tàbí ìsanwó, kí a má kọ ọ́ lẹ́ẹ̀mejì) | |
| `money.link` | Affiliate link (optional) | Ìjápọ̀ ìpolówó (kò pọn dandan) | |
| `money.none` | None | Kò sí | |
| `money.record` | Record | Kọ ọ́ sílẹ̀ | |
| `money.recorded` | Recorded. | A ti kọ ọ́ sílẹ̀. | |
| `money.noRevenue` | No revenue recorded yet. | A kò tíì kọ owó kankan sílẹ̀. | |
| `money.estimate` | estimate | àfojúbù | |
| `money.by` | by {who} | láti ọwọ́ {who} | |
| `money.links` | Affiliate links | Ìjápọ̀ ìpolówó alájọṣe | |
| `money.linkHelp` | Every link needs a disclosure in Yoruba and English, shown wherever you use it. | Ìjápọ̀ kọ̀ọ̀kan nílò ìkéde ní Yorùbá àti Gẹ̀ẹ́sì, tí a ó fi hàn níbikíbi tí o bá ti lò ó. | |
| `money.slug` | Short name (for /go/…) | Orúkọ kúkúrú (fún /go/…) | |
| `money.name` | Name | Orúkọ | |
| `money.partner` | Partner | Alájọṣe | |
| `money.destination` | Destination (https://) | Ibi tí ó ń lọ (https://) | |
| `money.disclosureYo` | Disclosure (Yoruba) | Ìkéde (Yorùbá) | |
| `money.disclosureEn` | Disclosure (English) | Ìkéde (Gẹ̀ẹ́sì) | |
| `money.commission` | Commission terms (notes) | Àdéhùn èrè (àkíyèsí) | |
| `money.addLink` | Add link | Fi ìjápọ̀ kún un | |
| `money.noLinks` | No affiliate links yet. | Kò sí ìjápọ̀ ìpolówó síbẹ̀. | |
| `money.clicks` | {n} clicks | Títẹ̀ {n} | |
| `money.paused` | Paused | Ó dúró | |
| `money.products` | Digital products | Ọjà orí ayélujára | |
| `money.nameYo` | Name (Yoruba) | Orúkọ (Yorùbá) | |
| `money.nameEn` | Name (English) | Orúkọ (Gẹ̀ẹ́sì) | |
| `money.kind` | Type | Irú | |
| `money.kinds.ebook` | E-book | Ìwé orí ayélujára | |
| `money.kinds.template` | Template | Àwòṣe | |
| `money.kinds.course` | Course | Ẹ̀kọ́ kíkún | |
| `money.kinds.workshop` | Workshop | Ìdánilẹ́kọ̀ọ́ | |
| `money.kinds.other` | Other | Òmíràn | |
| `money.price` | Price | Iye owó | |
| `money.status` | Status | Ipò | |
| `money.productStatus.draft` | Draft | Àkọpamọ́ | |
| `money.productStatus.active` | On sale | Ó wà fún títà | |
| `money.productStatus.archived` | Archived | A ti fi pamọ́ | |
| `money.delivery` | How the buyer receives it | Bí olùrà yóò ṣe gbà á | |
| `money.addProduct` | Add product | Fi ọjà kún un | |
| `money.noProducts` | No products yet. | Kò sí ọjà síbẹ̀. | |
| `money.buyerEmail` | Buyer's email | Ímeèlì olùrà | |
| `money.createCheckout` | Create payment link | Ṣe ìjápọ̀ ìsanwó | |
| `money.checkoutReady` | Payment link created: | A ti ṣe ìjápọ̀ ìsanwó: | |
| `money.checkoutSample` | Simulated order created (test mode): no payment link, no money taken. | A ṣe àfarawé ìbéèrè ọjà (ipò ìdánwò): kò sí ìjápọ̀ ìsanwó, a kò gba owó. | |
| `money.orders` | Recent orders | Àwọn ìbéèrè ọjà àìpẹ́ | |
| `money.orderStatus.pending` | Waiting for payment | Ó ń dúró de ìsanwó | |
| `money.orderStatus.paid` | Paid | A ti sanwó | |
| `money.orderStatus.failed` | Failed | Kò yọrí | |
| `money.orderStatus.refunded` | Refunded | A dá owó padà | |
| `money.sponsorships` | Sponsorships | Àwọn onígbọ̀wọ́ | |
| `money.sponsorHelp` | A sponsorship becomes "agreed" only with the signed agreement's reference. Videos linked to an agreed sponsorship carry a paid-partnership notice in every caption. | Ìgbọ̀wọ́ yóò di "àdéhùn" nígbà tí nọ́ńbà ìwé àdéhùn tí a buwọ́ lù bá wà nìkan. Fídíò tí a so mọ́ ìgbọ̀wọ́ tí a ti fẹnukò lé lórí yóò ní ìkéde ìbáṣepọ̀ onígbọ̀wọ́ nínú gbogbo àkọlé rẹ̀. | |
| `money.sponsor` | Sponsor | Onígbọ̀wọ́ | |
| `money.contact` | Contact | Ìkànsí | |
| `money.deliverables` | Deliverables | Ohun tí a ó ṣe | |
| `money.value` | Value | Iye | |
| `money.videos` | Videos it appears in | Fídíò tí ó ti hàn | |
| `money.addSponsorship` | Add sponsorship | Fi onígbọ̀wọ́ kún un | |
| `money.noSponsorships` | No sponsorships yet. | Kò sí onígbọ̀wọ́ síbẹ̀. | |
| `money.sponsorStatus.proposed` | Proposed | A dábàá | |
| `money.sponsorStatus.agreed` | Agreed | A fẹnukò | |
| `money.sponsorStatus.delivered` | Delivered | A ti ṣe é | |
| `money.sponsorStatus.paid` | Paid | A ti sanwó | |
| `money.sponsorStatus.cancelled` | Cancelled | A fagi lé e | |
| `money.contract` | Agreement reference | Nọ́ńbà ìwé àdéhùn | |
| `money.moveTo` | Mark as {status} | Sàmì sí i: {status} | |
| `stats.subtitle` | Figures from real records only: platform reports, your revenue entries and recorded costs. Nothing is estimated by this system. | Ìṣirò láti inú àkọsílẹ̀ gidi nìkan: ìròyìn ìkànnì, owó tí o kọ sílẹ̀ àti ìnáwó tí a kọ sílẹ̀. Ètò yìí kò fojú bù nǹkan kankan. | |
| `stats.period` | Period | Àkókò | |
| `stats.days` | {n} days | Ọjọ́ {n} | |
| `stats.sync` | Import YouTube figures now | Mú ìṣirò YouTube wọlé báyìí | |
| `stats.syncQueued` | Import started. | A ti bẹ̀rẹ̀ rẹ̀. | |
| `stats.views` | Views | Ìwòran | |
| `stats.watchHours` | Watch hours | Wákàtí ìwòran | |
| `stats.subscribers` | Subscribers gained | Olùforúkọsílẹ̀ tuntun | |
| `stats.ytRevenue` | YouTube estimated revenue | Owó àfojúbù YouTube | |
| `stats.notReported` | Not reported | A kò ròyìn rẹ̀ | |
| `stats.notReportedHelp` | YouTube has not reported revenue for this channel. Monetisation is not assumed. | YouTube kò tíì ròyìn owó fún ikanni yìí. A kò rò pé ìpawówọlé ti bẹ̀rẹ̀. | |
| `stats.revenueTotal` | Revenue ({currency}) | Owó tó wọlé ({currency}) | |
| `stats.noRevenue` | No revenue in this period | Kò sí owó tó wọlé ní àkókò yìí | |
| `stats.costs` | Provider costs (USD) | Ìnáwó olùpèsè (USD) | |
| `stats.net` | USD revenue minus costs | Owó USD tó wọlé yọ ìnáwó | |
| `stats.netHelp` | Naira revenue is shown separately and never converted. | A ń fi owó náírà hàn lọ́tọ̀, a kì í yí i padà. | |
| `stats.perVideo` | Cost per approved video | Ìnáwó fún fídíò kọ̀ọ̀kan tí a fọwọ́ sí | |
| `stats.noVideoYet` | No approved real videos in this period | Kò sí fídíò gidi tí a fọwọ́ sí ní àkókò yìí | |
| `stats.videos` | Published videos | Fídíò tí a ti gbé jáde | |
| `stats.noVideos` | No platform figures yet. They appear after real videos are uploaded and YouTube reports on them. | Kò sí ìṣirò ìkànnì síbẹ̀. Yóò hàn lẹ́yìn tí a bá gbé fídíò gidi sókè, tí YouTube sì ròyìn wọn. | |
| `stats.colVideo` | Video | Fídíò | |
| `stats.colViews` | Views | Ìwòran | |
| `stats.colWatch` | Watch hours | Wákàtí ìwòran | |
| `stats.colAvg` | Average view | Ìwòran ní àròpọ̀ | |
| `stats.colEngagement` | Engagement | Ìkópa | |
| `stats.colRevenue` | Revenue | Owó | |
| `stats.colRpm` | RPM | RPM | |
| `stats.partial` | partly reported | a ròyìn díẹ̀ | |
| `stats.monthly` | Revenue and costs by month | Owó àti ìnáwó lóṣooṣù | |
| `stats.noMonthly` | Nothing recorded yet. | A kò tíì kọ nǹkan sílẹ̀. | |
| `stats.colMonth` | Month | Oṣù | |
| `stats.colCost` | Costs | Ìnáwó | |
| `stats.affiliates` | Affiliate links | Ìjápọ̀ ìpolówó alájọṣe | |
| `stats.colClicks` | Clicks | Títẹ̀ | |
| `stats.colConversions` | Sales | Títà | |
| `stats.colRate` | Conversion | Ìyípadà | |
| `stats.colEpc` | Per click | Fún títẹ̀ kọ̀ọ̀kan | |
| `stats.pipeline` | Orders and sponsorships | Ìbéèrè ọjà àti onígbọ̀wọ́ | |
| `stats.noPipeline` | No orders or sponsorships yet. | Kò sí ìbéèrè ọjà tàbí onígbọ̀wọ́ síbẹ̀. | |
| `stats.estimatesNote` | Includes platform estimates, which can change and are not payouts. | Ó ní ìṣirò àfojúbù ìkànnì nínú, èyí tí ó lè yí padà, tí kì í sì í ṣe owó tí a ti san. | |
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
| `settings.autoPublishBlocked` | Automatic publishing unlocks after you approve 10 real videos (or the number you set) and connect a real platform account. Public uploads can be allowed only after that. | Ìtẹ̀jáde aládàáṣe yóò ṣí sílẹ̀ lẹ́yìn tí o bá fọwọ́ sí fídíò gidi mẹ́wàá (tàbí iye tí o yàn), tí o sì so àkáǹtì ìkànnì gidi kan pọ̀. Lẹ́yìn náà nìkan ni a lè gba ìgbéjáde fún gbogbo ènìyàn láàyè. | |
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
| `settings.labels.production.min_long_form_seconds` | Shortest long-form lesson | Ẹ̀kọ́ gígùn tí ó kúrú jù | |
| `settings.labels.publishing.paused` | Publishing paused | Ìtẹ̀jáde dúró | |
| `settings.labels.publishing.allow_public` | Allow public uploads | Gba ìgbéjáde fún gbogbo ènìyàn láàyè | |
| `settings.labels.publishing.daily_limit` | Uploads per day | Ìgbéjáde lójoojúmọ́ | |
| `settings.labels.publishing.auto_hour` | Automatic upload hour (Lagos) | Wákàtí ìgbéjáde aládàáṣe (Èkó) | |
| `settings.labels.publishing.youtube_daily_quota_units` | YouTube API units per day | Ìpín API YouTube lójoojúmọ́ | |
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
| `settings.help.production.min_long_form_seconds` | A real lesson shorter than this cannot become a long-form video (educational value gate). | Ẹ̀kọ́ gidi tí ó kúrú ju èyí lọ kò lè di fídíò ẹ̀kọ́ gígùn (àyẹ̀wò iye ẹ̀kọ́). | |
| `settings.help.publishing.paused` | Stops all uploads. Set automatically when a rights check, a quality check or an account permission fails; resume after fixing the cause. | Ó dá gbogbo ìgbéjáde dúró. Ó máa ń tàn fúnra rẹ̀ bí àyẹ̀wò àṣẹ, àyẹ̀wò dídára tàbí àṣẹ àkáǹtì bá kùnà; tẹ̀síwájú lẹ́yìn tí o bá ti tún ìdí rẹ̀ ṣe. | |
| `settings.help.publishing.allow_public` | Only possible once automatic publishing is unlocked. | Ó ṣeé ṣe lẹ́yìn tí ìtẹ̀jáde aládàáṣe bá ṣí sílẹ̀ nìkan. | |
| `settings.help.publishing.daily_limit` | Most uploads per day across all platforms. | Iye ìgbéjáde tó pọ̀ jùlọ lójoojúmọ́ lórí gbogbo ìkànnì. | |
| `settings.help.publishing.auto_hour` | When automatically scheduled uploads go out. | Àkókò tí ìgbéjáde aládàáṣe máa ń lọ. | |
| `settings.help.publishing.youtube_daily_quota_units` | An upload with captions and thumbnail uses about 2,050 units. | Ìgbéjáde kan pẹ̀lú àkọlé àti àwòrán àfihàn ń lo nǹkan bí ìpín 2,050. | |
| `settings.help.discovery.max_videos_per_scan` | Most videos recorded per channel scan. Each 50 videos use about 2 of YouTube's 10,000 free daily quota units. | Iye fídíò tó pọ̀ jùlọ tí a ó kọ sílẹ̀ nínú ìwádìí ikanni kan. Fídíò 50 kọ̀ọ̀kan ń lo nǹkan bí 2 nínú 10,000 ìpín ọ̀fẹ́ YouTube lójoojúmọ́. | |
| `settings.audit` | Audit trail | Àkọsílẹ̀ àyẹ̀wò | |
| `settings.auditSubtitle` | Every login, change and job, newest first. Entries cannot be edited or deleted. | Gbogbo ìwọlé, àyípadà àti iṣẹ́, láti tuntun jùlọ. A kò lè ṣàtúnṣe tàbí pa àkọsílẹ̀ rẹ́. | |
| `settings.time` | Time | Àkókò | |
| `settings.actor` | By | Ẹni | |
| `settings.action` | Action | Ìgbésẹ̀ | |
| `settings.item` | Item | Nǹkan | |
| `settings.older` | Older entries | Àkọsílẹ̀ àtẹ̀yìnwá | |
| `settings.newest` | Back to newest | Padà sí tuntun jùlọ | |
