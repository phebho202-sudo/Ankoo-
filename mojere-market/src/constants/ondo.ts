/**
 * The 18 local government areas (LGAs) of Ondo State.
 *
 * This list is used by the app before the database is connected, and is the
 * same list the database seed file inserts into the `locations` table.
 * Once Supabase is connected, the database becomes the source of truth so an
 * administrator can add towns and neighbourhoods without an app update.
 */
export type Lga = {
  slug: string;
  name: string;
  /** Main town / headquarters, used as a sensible default town. */
  headquarters: string;
};

export const ONDO_LGAS: readonly Lga[] = [
  { slug: 'akoko-north-east', name: 'Akoko North-East', headquarters: 'Ikare' },
  { slug: 'akoko-north-west', name: 'Akoko North-West', headquarters: 'Okeagbe' },
  { slug: 'akoko-south-east', name: 'Akoko South-East', headquarters: 'Isua' },
  { slug: 'akoko-south-west', name: 'Akoko South-West', headquarters: 'Oka' },
  { slug: 'akure-north', name: 'Akure North', headquarters: 'Iju/Itaogbolu' },
  { slug: 'akure-south', name: 'Akure South', headquarters: 'Akure' },
  { slug: 'ese-odo', name: 'Ese Odo', headquarters: 'Igbekebo' },
  { slug: 'idanre', name: 'Idanre', headquarters: 'Owena' },
  { slug: 'ifedore', name: 'Ifedore', headquarters: 'Igbara-Oke' },
  { slug: 'ilaje', name: 'Ilaje', headquarters: 'Igbokoda' },
  { slug: 'ile-oluji-okeigbo', name: 'Ile Oluji/Okeigbo', headquarters: 'Ile Oluji' },
  { slug: 'irele', name: 'Irele', headquarters: 'Irele' },
  { slug: 'odigbo', name: 'Odigbo', headquarters: 'Ore' },
  { slug: 'okitipupa', name: 'Okitipupa', headquarters: 'Okitipupa' },
  { slug: 'ondo-east', name: 'Ondo East', headquarters: 'Bolorunduro' },
  { slug: 'ondo-west', name: 'Ondo West', headquarters: 'Ondo' },
  { slug: 'ose', name: 'Ose', headquarters: 'Ifon' },
  { slug: 'owo', name: 'Owo', headquarters: 'Owo' },
] as const;

/** Launch focus: Akure and the FUTA community. */
export const LAUNCH_LGA_SLUG = 'akure-south';
