// Dashboard text in English and Yoruba.
//
// The Yoruba dictionary is typed as `Dictionary`, so TypeScript fails the build if any
// English string is missing a Yoruba translation.
//
// LANGUAGE REVIEW: the Yoruba strings below were written carefully with full tone marks,
// but, in line with the academy's own rule, they still need review by a fluent Nigerian
// Yoruba speaker before launch. See docs/YORUBA_UI_REVIEW.md.

export const en = {
  common: {
    appName: "OMỌLÚÀBÍ BUSINESS ACADEMY",
    tagline: "Practical business education in Yoruba",
    admin: "Admin",
    logout: "Log out",
    language: "Language",
    english: "English",
    yoruba: "Yorùbá",
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
    ok: "OK",
    down: "Down",
    yes: "Yes",
    no: "No",
    phase: "Phase {n}",
    notBuiltYet: "Not built yet",
    menu: "Menu",
    close: "Close",
    signedInAs: "Signed in as",
    unreachable: "The backend cannot be reached. No data is shown until it responds.",
  },
  nav: {
    groups: {
      main: "Main",
      content: "Content",
      production: "Production",
      distribution: "Distribution",
      business: "Business",
      system: "System",
    },
    overview: "Overview",
    episodes: "Episode catalogue",
    rights: "Rights management",
    research: "Research",
    scripts: "Yoruba scripts",
    voice: "Voice production",
    video: "Video production",
    calendar: "Publishing calendar",
    accounts: "Social accounts",
    analytics: "Analytics",
    monetisation: "Monetisation",
    settings: "System settings",
  },
  login: {
    title: "Log in to the admin dashboard",
    email: "Email",
    password: "Password",
    submit: "Log in",
    submitting: "Logging in…",
    invalid: "Incorrect email or password.",
    locked: "Too many failed attempts. Please try again in 15 minutes.",
    expired: "Your session has ended. Please log in again.",
    unreachable: "Cannot reach the server. Please try again shortly.",
  },
  overview: {
    title: "Overview",
    subtitle: "The live state of the academy's systems. Every number here comes from the database.",
    health: "System health",
    api: "API",
    database: "Database",
    redis: "Job queue (Redis)",
    providerMode: "Provider mode",
    sampleMode: "SAMPLE: no paid APIs are called",
    liveMode: "LIVE: real providers in use",
    environment: "Environment",
    spend: "Spend this month",
    ofLimit: "of {limit} monthly limit",
    spendNote: "Real provider costs only. Sample runs cost nothing.",
    alertAt: "Alert at {pct}%",
    jobs: "Background jobs",
    jobStatus: {
      queued: "Queued",
      running: "Running",
      succeeded: "Succeeded",
      failed: "Failed",
      blocked: "Blocked by a rule",
    },
    audit: "Audit trail",
    auditOk: "Intact. {n} entries verified.",
    auditBad: "Tampering detected. Investigate immediately.",
    recent: "Recent activity",
    noActivity: "No activity recorded yet.",
    setup: "Setup checklist",
    setupNote: "Each key needs your authorisation before it is added.",
    checklist: {
      owner_account: "Owner account created",
      anthropic_key: "Claude API key added",
      elevenlabs_key: "ElevenLabs key added",
      youtube_key: "YouTube Data API key added",
      live_mode: "Live mode switched on",
    },
    providers: "Service providers",
    capability: {
      llm: "Language model",
      tts: "Voice (TTS)",
      avatar: "Avatar presenter",
      storage: "Storage",
      video_source: "Video discovery",
      publisher: "Publishing",
    },
    providerState: {
      sample: "Sample",
      connected: "Ready",
      notConfigured: "Not configured",
    },
  },
  placeholder: {
    whatItWillDo: "What this page will do",
    safeguards: "Built-in safeguards",
    empty:
      "Nothing here yet. This page will show real records once Phase {n} is complete. No sample data is shown.",
  },
  pages: {
    episodes: {
      purpose:
        "Every source video discovered from authorised channels, with its details, transcript status and protection against duplicates.",
      safeguards: [
        "Only channels you authorise are scanned.",
        "The same video can never be added twice.",
      ],
    },
    rights: {
      purpose:
        "Licences and permissions for every adaptation: translation, adaptation, commercial and distribution rights, permitted platforms and expiry dates.",
      safeguards: [
        "Adaptation and publishing are blocked if permission is missing, expired or unclear.",
        "Original lessons must be independently written.",
      ],
    },
    research: {
      purpose:
        "Topic extraction and structured research reports. You choose which subjects become original Yoruba lessons.",
      safeguards: ["Nothing becomes a lesson without your approval."],
    },
    scripts: {
      purpose:
        "Yoruba lesson scripts with correct tone marks, revisions, a pronunciation dictionary, and English and Yoruba subtitles.",
      safeguards: [
        "Every script passes human language review.",
        "An automated quality score is a guide, never proof of perfect Yoruba.",
      ],
    },
    voice: {
      purpose:
        "Narration in the voice of the academy's original Nigerian Yoruba presenter, pronunciation tests, and the cost of each job.",
      safeguards: [
        "Pronunciation is tested before large-scale generation.",
        "Every job's cost is recorded.",
      ],
    },
    video: {
      purpose:
        "16:9 lessons, vertical Shorts and Reels, thumbnails and captions, rendered with FFmpeg.",
      safeguards: [
        "The low-cost hybrid format is the default.",
        "Every video must carry substantial original educational value.",
      ],
    },
    calendar: {
      purpose:
        "Scheduled releases on YouTube, Facebook, Instagram and TikTok, with upload confirmations and logs.",
      safeguards: [
        "Nothing is published without approval and a passed rights check.",
        "New integrations start in private or draft mode.",
        "Automatic publishing unlocks only after you approve the first 10 videos.",
      ],
    },
    accounts: {
      purpose: "Connected YouTube, Meta and TikTok accounts and the state of their permissions.",
      safeguards: [
        "Publishing stops automatically when an account's permissions expire.",
        "Access tokens are stored encrypted and never displayed.",
      ],
    },
    analytics: {
      purpose:
        "Views, watch time and audience growth for each video and platform, from the platforms' own reports.",
      safeguards: ["Figures come only from platform data, never estimates presented as facts."],
    },
    monetisation: {
      purpose: "Affiliate links, digital products, sponsorships and YouTube earnings.",
      safeguards: [
        "No earnings are shown until they are actually reported.",
        "YouTube monetisation is never assumed to be approved.",
      ],
    },
  },
  settings: {
    title: "System settings",
    subtitle:
      "Limits and rules the platform must obey. Every change is recorded in the audit trail.",
    categories: {
      budget: "Budget and cost control",
      storage: "Storage",
      publishing: "Publishing",
      production: "Production",
    },
    default: "Default",
    custom: "Changed",
    changedBy: "Last changed by {who}",
    spendingLimit: "Spending limit",
    range: "Allowed: {min} to {max}",
    confirmIncrease: "I approve raising this spending limit",
    needsConfirmation:
      "Raising a spending limit needs your explicit approval. Tick the box to confirm.",
    autoPublishBlocked:
      "Automatic publishing stays off until the publishing system is built and you have approved the first 10 videos.",
    invalid: "This value was not accepted: {msg}",
    failed: "The change could not be saved: {msg}",
    on: "On",
    off: "Off",
    choices: {
      private: "Private",
      unlisted: "Unlisted",
      hybrid: "Hybrid (low cost)",
      full_avatar: "Full avatar",
    },
    labels: {
      "budget.monthly_limit_usd": "Monthly spending limit",
      "budget.alert_threshold_percent": "Spending alert at",
      "budget.max_cost_per_video_usd": "Maximum cost per video",
      "budget.max_avatar_minutes_per_month": "Avatar minutes per month",
      "budget.max_retries_per_job": "Maximum retries per job",
      "storage.max_storage_gb": "Storage limit",
      "publishing.auto_publish_enabled": "Automatic publishing",
      "publishing.required_approved_videos": "Approved videos before automation",
      "publishing.default_visibility": "Default upload visibility",
      "production.default_video_format": "Default video format",
    } as Record<string, string>,
    help: {
      "budget.monthly_limit_usd": "Maximum total provider spend per calendar month.",
      "budget.alert_threshold_percent":
        "Alert the owner when monthly spend reaches this share of the limit.",
      "budget.max_cost_per_video_usd": "A video job stops if its provider cost would exceed this.",
      "budget.max_avatar_minutes_per_month":
        "Avatar rendering minutes allowed per month (0 = hybrid format only).",
      "budget.max_retries_per_job": "Retry cap for a failed job. Each retry can cost money.",
      "storage.max_storage_gb": "Total media storage allowed.",
      "publishing.auto_publish_enabled": "Publish approved videos automatically on schedule.",
      "publishing.required_approved_videos":
        "Owner-approved videos required before automatic publishing can be enabled (minimum 10).",
      "publishing.default_visibility":
        "Visibility for new uploads. Public is not allowed during the trial period.",
      "production.default_video_format": "Default presenter format. Hybrid is the low-cost default.",
    } as Record<string, string>,
    audit: "Audit trail",
    auditSubtitle: "Every login, change and job, newest first. Entries cannot be edited or deleted.",
    time: "Time",
    actor: "By",
    action: "Action",
    item: "Item",
    older: "Older entries",
    newest: "Back to newest",
  },
};

export type Dictionary = typeof en;

export const yo: Dictionary = {
  common: {
    appName: "OMỌLÚÀBÍ BUSINESS ACADEMY",
    tagline: "Ẹ̀kọ́ iṣẹ́ òwò tó wúlò ní èdè Yorùbá",
    admin: "Ìṣàkóso",
    logout: "Jáde",
    language: "Èdè",
    english: "English",
    yoruba: "Yorùbá",
    save: "Fi pamọ́",
    saving: "Ó ń fi pamọ́…",
    saved: "A ti fi pamọ́",
    ok: "Ó ń ṣiṣẹ́",
    down: "Kò ṣiṣẹ́",
    yes: "Bẹ́ẹ̀ni",
    no: "Rárá",
    phase: "Ìpele {n}",
    notBuiltYet: "A kò tíì kọ́ ọ",
    menu: "Àkójọ",
    close: "Pa á dé",
    signedInAs: "O wọlé gẹ́gẹ́ bí",
    unreachable: "A kò lè dé ọ̀dọ̀ sáfà. A kò ní fi dátà kankan hàn títí yóò fi dáhùn.",
  },
  nav: {
    groups: {
      main: "Pàtàkì",
      content: "Àkóónú",
      production: "Ìṣẹ̀dá",
      distribution: "Ìpínkiri",
      business: "Òwò",
      system: "Sístẹ́mù",
    },
    overview: "Àkópọ̀",
    episodes: "Àkójọ àwọn ìpín",
    rights: "Ìṣàkóso ẹ̀tọ́",
    research: "Ìwádìí",
    scripts: "Àkọsílẹ̀ Yorùbá",
    voice: "Ìṣẹ̀dá ohùn",
    video: "Ìṣẹ̀dá fídíò",
    calendar: "Kàlẹ́ńdà ìtẹ̀jáde",
    accounts: "Àwọn àkáǹtì ìkànnì àjọlò",
    analytics: "Ìtúpalẹ̀ ìṣirò",
    monetisation: "Ìpawówọlé",
    settings: "Ètò sístẹ́mù",
  },
  login: {
    title: "Wọlé sí ojú-ìṣàkóso",
    email: "Ímeèlì",
    password: "Ọ̀rọ̀ aṣínà",
    submit: "Wọlé",
    submitting: "Ó ń wọlé…",
    invalid: "Ímeèlì tàbí ọ̀rọ̀ aṣínà kò tọ̀nà.",
    locked: "Ìgbìyànjú tí kò yọrí ti pọ̀ jù. Jọ̀ọ́ gbìyànjú lẹ́ẹ̀kan sí i lẹ́yìn ìṣẹ́jú mẹ́ẹ̀ẹ́dógún.",
    expired: "Àkókò ìwọlé rẹ ti parí. Jọ̀ọ́ wọlé lẹ́ẹ̀kan sí i.",
    unreachable: "A kò lè dé ọ̀dọ̀ sáfà. Jọ̀ọ́ gbìyànjú láìpẹ́.",
  },
  overview: {
    title: "Àkópọ̀",
    subtitle:
      "Ipò àwọn ẹ̀rọ ilé-ẹ̀kọ́ náà lọ́wọ́lọ́wọ́. Gbogbo nọ́ńbà ibí yìí wá láti inú ibi ìpamọ́ dátà.",
    health: "Ìlera sístẹ́mù",
    api: "API",
    database: "Ibi ìpamọ́ dátà",
    redis: "Ìlà iṣẹ́ (Redis)",
    providerMode: "Ipò àwọn olùpèsè",
    sampleMode: "ÀPẸẸRẸ: a kò pe API tí a ń sanwó fún",
    liveMode: "GIDI: àwọn olùpèsè gidi ni a ń lò",
    environment: "Àyíká",
    spend: "Ìnáwó oṣù yìí",
    ofLimit: "nínú òpin oṣooṣù {limit}",
    spendNote: "Owó gidi tí a ná lórí àwọn olùpèsè nìkan. Àwọn àpẹẹrẹ kò náwó kankan.",
    alertAt: "Ìkìlọ̀ ní {pct}%",
    jobs: "Àwọn iṣẹ́ abẹ́lẹ̀",
    jobStatus: {
      queued: "Ń dúró",
      running: "Ń lọ lọ́wọ́",
      succeeded: "Ó yọrí",
      failed: "Kò yọrí",
      blocked: "Òfin dí i lọ́nà",
    },
    audit: "Àkọsílẹ̀ àyẹ̀wò",
    auditOk: "Kò sí àyípadà. A ti ṣàyẹ̀wò àkọsílẹ̀ {n}.",
    auditBad: "A rí àyípadà tí kò bófin mu. Ṣèwádìí lẹ́sẹ̀kẹsẹ̀.",
    recent: "Ìṣẹ̀lẹ̀ àìpẹ́",
    noActivity: "Kò sí ìṣẹ̀lẹ̀ kankan tí a kọ sílẹ̀ síbẹ̀.",
    setup: "Àwọn ìgbésẹ̀ ìṣètò",
    setupNote: "Kọ́kọ́rọ́ kọ̀ọ̀kan nílò àṣẹ rẹ kí a tó fi kún un.",
    checklist: {
      owner_account: "A ti ṣẹ̀dá àkáǹtì ọ̀gá",
      anthropic_key: "A ti fi kọ́kọ́rọ́ Claude API kún un",
      elevenlabs_key: "A ti fi kọ́kọ́rọ́ ElevenLabs kún un",
      youtube_key: "A ti fi kọ́kọ́rọ́ YouTube Data API kún un",
      live_mode: "A ti tan ipò gidi",
    },
    providers: "Àwọn olùpèsè iṣẹ́",
    capability: {
      llm: "Ẹ̀rọ èdè",
      tts: "Ohùn (TTS)",
      avatar: "Olùkọ́ avatar",
      storage: "Ibi ìpamọ́",
      video_source: "Ìwádìí fídíò",
      publisher: "Ìtẹ̀jáde",
    },
    providerState: {
      sample: "Àpẹẹrẹ",
      connected: "Ó ti ṣe tán",
      notConfigured: "A kò tíì ṣètò rẹ̀",
    },
  },
  placeholder: {
    whatItWillDo: "Ohun tí ojú-ìwé yìí yóò ṣe",
    safeguards: "Àwọn ààbò tí a kọ́ sínú rẹ̀",
    empty:
      "Kò sí nǹkan níbí síbẹ̀. Ojú-ìwé yìí yóò fi àkọsílẹ̀ gidi hàn lẹ́yìn tí Ìpele {n} bá parí. A kò fi dátà àpẹẹrẹ hàn.",
  },
  pages: {
    episodes: {
      purpose:
        "Gbogbo fídíò orísun tí a rí láti inú àwọn ikanni tí o fún láṣẹ, pẹ̀lú àlàyé wọn, ipò àkọsílẹ̀ ọ̀rọ̀ wọn, àti ìdènà fún fídíò tí a ti ní tẹ́lẹ̀.",
      safeguards: [
        "Àwọn ikanni tí o fún láṣẹ nìkan ni a ó yẹ̀wò.",
        "A kò lè fi fídíò kan náà kún un lẹ́ẹ̀mejì.",
      ],
    },
    rights: {
      purpose:
        "Ìwé àṣẹ àti ìyọ̀ǹda fún àtúnṣe kọ̀ọ̀kan: ẹ̀tọ́ ìtumọ̀, ẹ̀tọ́ àtúnṣe, ẹ̀tọ́ òwò àti ẹ̀tọ́ ìpínkiri, àwọn ìkànnì tí a gbà láàyè, àti ọjọ́ tí àṣẹ yóò parí.",
      safeguards: [
        "A ó dí àtúnṣe àti ìtẹ̀jáde lọ́nà bí ìyọ̀ǹda kò bá sí, tí ó ti parí, tàbí tí kò ṣe kedere.",
        "Ẹ̀kọ́ tuntun gbọ́dọ̀ jẹ́ èyí tí a kọ fúnra wa.",
      ],
    },
    research: {
      purpose:
        "Yíyọ àwọn kókó ọ̀rọ̀ jáde àti ìròyìn ìwádìí tó wà létòlétò. Ìwọ ni yóò yan kókó tí yóò di ẹ̀kọ́ Yorùbá tuntun.",
      safeguards: ["Kò sí ohun tí yóò di ẹ̀kọ́ láìsí ìfọwọ́sí rẹ."],
    },
    scripts: {
      purpose:
        "Àkọsílẹ̀ ẹ̀kọ́ ní èdè Yorùbá pẹ̀lú àmì ohùn tó tọ̀nà, àtúnyẹ̀wò, ìwé atúmọ̀ ìpè ọ̀rọ̀, àti àkọlé ìsàlẹ̀ ní Gẹ̀ẹ́sì àti Yorùbá.",
      safeguards: [
        "Ènìyàn tó gbọ́ èdè dáadáa gbọ́dọ̀ ṣàyẹ̀wò àkọsílẹ̀ kọ̀ọ̀kan.",
        "Máàkì àyẹ̀wò láti ọwọ́ ẹ̀rọ jẹ́ ìtọ́sọ́nà nìkan, kì í ṣe ẹ̀rí pé Yorùbá náà péye.",
      ],
    },
    voice: {
      purpose:
        "Ohùn ìsọ̀rọ̀ olùkọ́ Yorùbá ọmọ Nàìjíríà tí ilé-ẹ̀kọ́ náà ṣẹ̀dá, ìdánwò ìpè ọ̀rọ̀, àti iye owó iṣẹ́ kọ̀ọ̀kan.",
      safeguards: [
        "A ó dán ìpè ọ̀rọ̀ wò kí a tó ṣe ohùn lọ́pọ̀lọpọ̀.",
        "A ó kọ iye owó iṣẹ́ kọ̀ọ̀kan sílẹ̀.",
      ],
    },
    video: {
      purpose:
        "Ẹ̀kọ́ 16:9, fídíò ìdúró (Shorts àti Reels), àwòrán àfihàn àti àkọlé, tí a ṣe pẹ̀lú FFmpeg.",
      safeguards: [
        "Ọ̀nà àdàpọ̀ tí kò wọ́n ni a ó máa lò.",
        "Fídíò kọ̀ọ̀kan gbọ́dọ̀ ní ẹ̀kọ́ tuntun tó jinlẹ̀.",
      ],
    },
    calendar: {
      purpose:
        "Ètò ìgbà ìtẹ̀jáde lórí YouTube, Facebook, Instagram àti TikTok, pẹ̀lú ìfìdímúlẹ̀ ìgbéjáde àti àkọsílẹ̀.",
      safeguards: [
        "A kò ní tẹ ohunkóhun jáde láìsí ìfọwọ́sí àti àyẹ̀wò ẹ̀tọ́ tó yege.",
        "Ìsopọ̀ tuntun yóò bẹ̀rẹ̀ ní ipò àṣírí tàbí àkọ́pamọ́.",
        "Ìtẹ̀jáde aládàáṣe yóò ṣí sílẹ̀ lẹ́yìn tí o bá fọwọ́ sí fídíò mẹ́wàá àkọ́kọ́ nìkan.",
      ],
    },
    accounts: {
      purpose: "Àwọn àkáǹtì YouTube, Meta àti TikTok tí a so pọ̀ àti ipò àṣẹ wọn.",
      safeguards: [
        "Ìtẹ̀jáde yóò dúró fúnra rẹ̀ nígbà tí àṣẹ àkáǹtì kan bá parí.",
        "A ń fi kọ́kọ́rọ́ ìwọlé pamọ́ ní ìkọ̀kọ̀, a kò sì ní fi hàn láé.",
      ],
    },
    analytics: {
      purpose:
        "Iye ìwò, àkókò wíwò àti ìdàgbàsókè àwọn olùwò fún fídíò àti ìkànnì kọ̀ọ̀kan, láti inú ìròyìn tí àwọn ìkànnì náà fúnra wọn gbé jáde.",
      safeguards: [
        "Àwọn nọ́ńbà yóò wá láti inú dátà àwọn ìkànnì nìkan, kì í ṣe àmọ̀rò tí a gbé kalẹ̀ bí òtítọ́.",
      ],
    },
    monetisation: {
      purpose: "Ìjápọ̀ affiliate, ọjà oní-nọ́ńbà, ìgbọ̀wọ́ àti owó tí a ń rí lórí YouTube.",
      safeguards: [
        "A kò ní fi owó-wíwọlé kankan hàn títí tí a ó fi gbà á ní ti gidi.",
        "A kò ní rò pé YouTube ti fọwọ́ sí ìpawówọlé láìsí ẹ̀rí.",
      ],
    },
  },
  settings: {
    title: "Ètò sístẹ́mù",
    subtitle:
      "Àwọn òpin àti òfin tí sístẹ́mù gbọ́dọ̀ tẹ̀lé. A ń kọ gbogbo àyípadà sínú àkọsílẹ̀ àyẹ̀wò.",
    categories: {
      budget: "Ìṣúná àti ìṣàkóso ìnáwó",
      storage: "Ibi ìpamọ́",
      publishing: "Ìtẹ̀jáde",
      production: "Ìṣẹ̀dá",
    },
    default: "Àtilẹ̀wá",
    custom: "A ti yí i padà",
    changedBy: "Ẹni tó yí i padà kẹ́yìn: {who}",
    spendingLimit: "Òpin ìnáwó",
    range: "Ohun tí a gbà: {min} sí {max}",
    confirmIncrease: "Mo fọwọ́ sí i pé kí a gbé òpin ìnáwó yìí sókè",
    needsConfirmation:
      "Gbígbé òpin ìnáwó sókè nílò ìfọwọ́sí rẹ. Fi àmì sí àpótí náà láti fìdí rẹ̀ múlẹ̀.",
    autoPublishBlocked:
      "Ìtẹ̀jáde aládàáṣe yóò wà ní pípa títí tí a ó fi kọ́ ètò ìtẹ̀jáde, tí o sì fọwọ́ sí fídíò mẹ́wàá àkọ́kọ́.",
    invalid: "A kò gba iye yìí: {msg}",
    failed: "A kò lè fi àyípadà náà pamọ́: {msg}",
    on: "Títàn",
    off: "Pípa",
    choices: {
      private: "Àṣírí",
      unlisted: "Kò sí nínú àkójọ",
      hybrid: "Àdàpọ̀ (owó kékeré)",
      full_avatar: "Avatar pípé",
    },
    labels: {
      "budget.monthly_limit_usd": "Òpin ìnáwó oṣooṣù",
      "budget.alert_threshold_percent": "Ìkìlọ̀ ìnáwó ní",
      "budget.max_cost_per_video_usd": "Owó tó pọ̀ jù fún fídíò kan",
      "budget.max_avatar_minutes_per_month": "Ìṣẹ́jú avatar lóṣù",
      "budget.max_retries_per_job": "Ìgbìyànjú tó pọ̀ jù fún iṣẹ́ kan",
      "storage.max_storage_gb": "Òpin ibi ìpamọ́",
      "publishing.auto_publish_enabled": "Ìtẹ̀jáde aládàáṣe",
      "publishing.required_approved_videos": "Fídíò tí a fọwọ́ sí kí aládàáṣe tó bẹ̀rẹ̀",
      "publishing.default_visibility": "Ìrísí ìgbéjáde àtilẹ̀wá",
      "production.default_video_format": "Ọ̀nà fídíò àtilẹ̀wá",
    },
    help: {
      "budget.monthly_limit_usd":
        "Àpapọ̀ owó tó pọ̀ jù tí a lè ná lórí àwọn olùpèsè ní oṣù kan.",
      "budget.alert_threshold_percent":
        "Kìlọ̀ fún ọ̀gá nígbà tí ìnáwó oṣù bá dé ìpín yìí nínú òpin.",
      "budget.max_cost_per_video_usd": "Iṣẹ́ fídíò yóò dúró bí owó rẹ̀ bá fẹ́ kọjá iye yìí.",
      "budget.max_avatar_minutes_per_month":
        "Ìṣẹ́jú avatar tí a gbà láàyè lóṣù (0 = ọ̀nà àdàpọ̀ nìkan).",
      "budget.max_retries_per_job":
        "Iye ìgbà tí a lè tún gbìyànjú iṣẹ́ tí kò yọrí. Ìgbìyànjú kọ̀ọ̀kan lè náwó.",
      "storage.max_storage_gb": "Àpapọ̀ ibi ìpamọ́ tí a gbà láàyè fún fídíò àti ohùn.",
      "publishing.auto_publish_enabled":
        "Tẹ fídíò tí a fọwọ́ sí jáde fúnra rẹ̀ ní àkókò tí a ṣètò.",
      "publishing.required_approved_videos":
        "Iye fídíò tí ọ̀gá gbọ́dọ̀ fọwọ́ sí kí ìtẹ̀jáde aládàáṣe tó ṣeé ṣe (ó kéré tán mẹ́wàá).",
      "publishing.default_visibility":
        "Ìrísí fún fídíò tuntun. A kò gbà á láàyè fún gbogbo ènìyàn nígbà ìdánwò.",
      "production.default_video_format":
        "Ọ̀nà olùkọ́ àtilẹ̀wá. Àdàpọ̀ ni èyí tí owó rẹ̀ kéré.",
    },
    audit: "Àkọsílẹ̀ àyẹ̀wò",
    auditSubtitle:
      "Gbogbo ìwọlé, àyípadà àti iṣẹ́, láti tuntun jùlọ. A kò lè ṣàtúnṣe tàbí pa àkọsílẹ̀ rẹ́.",
    time: "Àkókò",
    actor: "Ẹni",
    action: "Ìgbésẹ̀",
    item: "Nǹkan",
    older: "Àkọsílẹ̀ àtẹ̀yìnwá",
    newest: "Padà sí tuntun jùlọ",
  },
};

export const dictionaries = { en, yo } as const;
export type Locale = keyof typeof dictionaries;
export const LOCALES: Locale[] = ["en", "yo"];
