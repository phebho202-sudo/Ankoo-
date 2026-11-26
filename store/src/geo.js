'use strict';
// Nigerian states (36 + FCT) and an ISO country list generated from Node's built-in ICU data.
const NG_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta',
  'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
  'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara',
];

let countries;
function countryList() {
  if (countries) return countries;
  const dn = new Intl.DisplayNames(['en'], { type: 'region' });
  const out = [];
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const a of A) {
    for (const b of A) {
      const code = a + b;
      if (['EU', 'EZ', 'UN', 'QO', 'XA', 'XB', 'ZZ', 'AA', 'XK'].includes(code)) continue;
      let name;
      try { name = dn.of(code); } catch { continue; }
      if (name && name !== code && !/unknown/i.test(name)) out.push({ code, name });
    }
  }
  countries = out.sort((x, y) => x.name.localeCompare(y.name));
  return countries;
}
function countryName(code) {
  const c = countryList().find((x) => x.code === String(code).toUpperCase());
  return c ? c.name : code;
}
module.exports = { NG_STATES, countryList, countryName };
