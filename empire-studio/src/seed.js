'use strict';
// DEMO DATA. Everything inserted here is flagged is_demo = 1 and shows a "DEMO" badge in the app.
// The numbers and notes are invented placeholders, not real research or real channel statistics.
// Remove it all from Settings -> Demo data -> "Remove demo data".

function dayOffset(today, days) {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function monthOffset(today, months) {
  const d = new Date(`${today.slice(0, 7)}-15T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 7);
}

const PLACEHOLDER = 'Demo placeholder. Replace with your own verified research before using it in a script.';

function seedDemo(db, today, settings) {
  const main = settings.main_publish_time;
  const shorts = settings.shorts_publish_time;
  const add = (table, row) => db.insert(table, row, 1).id;

  const t = {
    lvmh: add('topics', { title: 'How LVMH Became the Empire Behind Luxury', category: 'Luxury Brands', potential_score: 92, status: 'in_production', angle: 'One holding company, dozens of heritage houses: how acquisitions built a luxury giant.', notes: 'Demo topic.' }),
    ferrari: add('topics', { title: 'Why Ferrari Makes Fewer Cars on Purpose', category: 'Luxury Brands', potential_score: 88, status: 'in_production', angle: 'Scarcity as a business model.', notes: 'Demo topic.' }),
    rockefeller: add('topics', { title: 'The Rise and Breakup of Standard Oil', category: 'Business History', potential_score: 85, status: 'in_production', angle: 'How one company came to dominate an industry, and what ended it.', notes: 'Demo topic.' }),
    costco: add('topics', { title: 'The Membership Model: How Costco Really Makes Money', category: 'Corporate Empires', potential_score: 81, status: 'in_production', angle: 'Low margins on products, steady income from memberships.', notes: 'Demo topic.' }),
    rolex: add('topics', { title: 'Rolex: The Brand Owned by a Foundation', category: 'Luxury Brands', potential_score: 84, status: 'approved', angle: 'Ownership structure and long-term thinking.', notes: 'Demo topic.' }),
    psychology: add('topics', { title: 'Why Lottery Winners Often Lose It All', category: 'Wealth Psychology', potential_score: 78, status: 'shortlisted', angle: 'The psychology of sudden wealth.', notes: 'Demo topic.' }),
    aldi: add('topics', { title: 'The Secretive Family Behind Aldi', category: 'Billionaires', potential_score: 74, status: 'idea', angle: 'Extreme frugality at global scale.', notes: 'Demo topic.' }),
    kodak: add('topics', { title: 'How Kodak Missed the Digital Camera', category: 'Business History', potential_score: 69, status: 'idea', angle: 'A market leader that saw the future and still fell behind.', notes: 'Demo topic.' }),
    crypto: add('topics', { title: 'Overnight Crypto Millionaires', category: 'Wealth Psychology', potential_score: 41, status: 'rejected', angle: 'Too trend-dependent for a 45-minute evergreen documentary.', notes: 'Demo topic.' }),
  };

  for (const [topic, title, type, cred] of [
    [t.lvmh, 'Company annual report (latest year)', 'company filing', 'high'],
    [t.lvmh, 'Biography of the founder', 'book', 'high'],
    [t.lvmh, 'Timeline of major acquisitions', 'article', 'medium'],
    [t.ferrari, 'Investor presentation on production volumes', 'company filing', 'high'],
    [t.ferrari, 'Long-form interview with a former executive', 'interview', 'medium'],
    [t.rockefeller, 'Court ruling that ordered the breakup', 'report', 'high'],
    [t.costco, 'Annual report: membership fee income', 'company filing', 'high'],
    [t.rolex, 'Background on the owning foundation', 'article', 'unverified'],
  ]) add('research', { topic_id: topic, title, source_type: type, credibility: cred, summary: PLACEHOLDER });

  add('scripts', {
    topic_id: t.lvmh, title: 'How LVMH Became the Empire Behind Luxury', status: 'approved',
    content: '[DEMO SCRIPT - placeholder text, not a finished script]\n\nCOLD OPEN\nA single sentence that makes the viewer need the answer.\n\nACT 1 - THE ORIGIN\nWhere the story starts and who is involved.\n\nACT 2 - THE STRATEGY\nThe decisions that built the empire.\n\nACT 3 - THE CONFLICTS\nRivals, setbacks and the moments it nearly failed.\n\nACT 4 - THE EMPIRE TODAY\nWhat it looks like now and what it means.\n\nCLOSING\nThe lesson, and the hook for the next documentary.',
  });
  add('scripts', {
    topic_id: t.ferrari, title: 'Why Ferrari Makes Fewer Cars on Purpose', status: 'draft',
    content: '[DEMO SCRIPT - placeholder text]\n\nCOLD OPEN\nMost companies want to sell more. This one refuses to.\n\nACT 1\nNotes go here.',
  });
  add('scripts', { topic_id: t.rolex, title: 'Rolex: The Brand Owned by a Foundation', status: 'outline', content: '[DEMO OUTLINE]\n\n1. Hook\n2. Origins\n3. The foundation\n4. Why it matters' });

  const done = { script_status: 'done', voice_status: 'done', visuals_status: 'done', edit_status: 'done', thumbnail_status: 'done' };
  const j = {
    rockefeller: add('jobs', { topic_id: t.rockefeller, title: 'The Rise and Breakup of Standard Oil', ...done, notes: 'Demo job. Finished and published.' }),
    costco: add('jobs', { topic_id: t.costco, title: 'The Membership Model: How Costco Really Makes Money', ...done, notes: 'Demo job. Finished, waiting for your approval.' }),
    lvmh: add('jobs', { topic_id: t.lvmh, title: 'How LVMH Became the Empire Behind Luxury', script_status: 'done', voice_status: 'done', visuals_status: 'in_progress', edit_status: 'not_started', thumbnail_status: 'in_progress', notes: 'Demo job.' }),
    ferrari: add('jobs', { topic_id: t.ferrari, title: 'Why Ferrari Makes Fewer Cars on Purpose', script_status: 'in_progress', notes: 'Demo job.' }),
    short: add('jobs', { topic_id: t.costco, title: 'Short: The $1.50 Hot Dog Rule', format: 'short', ...done, notes: 'Demo job.' }),
  };

  for (const [job, kind, name, details, status] of [
    [j.lvmh, 'voice', 'Cold open narration', 'Slow, measured delivery. Pause before the title card.', 'approved'],
    [j.lvmh, 'voice', 'Act 1 narration', 'Warm documentary tone.', 'ready'],
    [j.lvmh, 'voice', 'Act 2 narration', 'Slightly faster pace for the acquisition sequence.', 'in_progress'],
    [j.ferrari, 'voice', 'Cold open narration', 'Waiting for the script to be approved.', 'planned'],
    [j.lvmh, 'visual', 'Scene 1 - Paris at dawn', 'Prompt idea: cinematic aerial of Paris rooftops at dawn, soft golden light, slow push-in.', 'ready'],
    [j.lvmh, 'visual', 'Scene 2 - The workshop', 'Prompt idea: close-up of hands stitching leather, shallow depth of field, warm tungsten light.', 'in_progress'],
    [j.lvmh, 'visual', 'Scene 3 - Boardroom', 'Prompt idea: empty boardroom, long table, city skyline at dusk.', 'planned'],
    [j.ferrari, 'visual', 'Scene 1 - Factory gates', 'Prompt idea: red sports car leaving factory gates at sunrise.', 'planned'],
    [j.lvmh, 'thumbnail', 'THE LUXURY EMPIRE', 'Concept A: founder silhouette against a wall of brand logos, gold text.', 'in_progress'],
    [j.lvmh, 'thumbnail', 'ONE MAN. 75 BRANDS.', 'Concept B: bold number, dark background.', 'planned'],
    [j.costco, 'thumbnail', 'THE $60 SECRET', 'Membership card close-up, high contrast.', 'approved'],
  ]) add('assets', { job_id: job, kind, name, details, status, content: kind === 'voice' ? 'This is demo narration text. Replace it with the real words for this part of the script, then press Preview to hear a rough read-through.' : '' });

  for (const [job, title, format, days, status, url] of [
    [j.rockefeller, 'The Rise and Breakup of Standard Oil', 'documentary', -14, 'published', ''],
    [j.short, 'Short: The $1.50 Hot Dog Rule', 'short', -6, 'published', ''],
    [j.costco, 'The Membership Model: How Costco Really Makes Money', 'documentary', 3, 'awaiting_approval', ''],
    [null, 'Short: Why Costco Checks Your Receipt', 'short', 5, 'awaiting_approval', ''],
    [j.lvmh, 'How LVMH Became the Empire Behind Luxury', 'documentary', 10, 'scheduled', ''],
    [null, 'Short: The Handbag That Costs More Than a Car', 'short', 12, 'scheduled', ''],
    [j.ferrari, 'Why Ferrari Makes Fewer Cars on Purpose', 'documentary', 24, 'scheduled', ''],
  ]) add('publishing', { job_id: job, title, format, publish_date: dayOffset(today, days), publish_time: format === 'short' ? shorts : main, status, youtube_url: url, notes: 'Demo record. Nothing was uploaded to YouTube.' });

  [[-5, 1200, 95, 28, 0], [-4, 3400, 260, 71, 0], [-3, 6100, 410, 102, 0], [-2, 9800, 640, 148, 0], [-1, 14200, 890, 187, 0], [0, 5300, 310, 64, 0]]
    .forEach(([m, views, hours, subs, rev]) => {
      const month = monthOffset(today, m);
      if (!db.raw.prepare('SELECT 1 FROM metrics WHERE month = ?').get(month)) {
        add('metrics', { month, views, watch_hours: hours, subscribers_gained: subs, revenue_usd: rev });
      }
    });
}

module.exports = { seedDemo, dayOffset };
