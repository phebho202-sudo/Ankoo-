import Head from 'expo-router/head';

import { BRAND } from '@/constants/brand';

/** Sets the browser tab title on the website. Does nothing in the phone apps. */
export function PageTitle({ title }: { title?: string }) {
  return (
    <Head>
      <title>{title ? `${title} · ${BRAND.name}` : `${BRAND.name} · Buy and sell in ${BRAND.region}`}</title>
    </Head>
  );
}
