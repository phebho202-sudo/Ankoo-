import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type Category = { slug: string; name: string; icon: IconName };

/**
 * Initial product categories. The database seed inserts the same list;
 * after that, administrators manage categories in the database.
 */
export const INITIAL_CATEGORIES: readonly Category[] = [
  { slug: 'phones-tablets', name: 'Phones and tablets', icon: 'phone-portrait-outline' },
  { slug: 'electronics', name: 'Electronics', icon: 'tv-outline' },
  { slug: 'furniture', name: 'Furniture', icon: 'bed-outline' },
  { slug: 'home-appliances', name: 'Home appliances', icon: 'snow-outline' },
  { slug: 'fashion-clothing', name: 'Fashion and clothing', icon: 'shirt-outline' },
  { slug: 'shoes-bags', name: 'Shoes and bags', icon: 'bag-handle-outline' },
  { slug: 'baby-children', name: 'Baby and children’s items', icon: 'happy-outline' },
  { slug: 'books-education', name: 'Books and educational materials', icon: 'book-outline' },
  { slug: 'sports-fitness', name: 'Sports and fitness', icon: 'football-outline' },
  { slug: 'tools-equipment', name: 'Tools and equipment', icon: 'hammer-outline' },
  { slug: 'kitchen-household', name: 'Kitchen and household', icon: 'restaurant-outline' },
  { slug: 'vehicles-accessories', name: 'Vehicles and accessories', icon: 'car-outline' },
  { slug: 'other', name: 'Other items', icon: 'apps-outline' },
] as const;

export const CONDITIONS = [
  { value: 'brand_new', label: 'Brand new' },
  { value: 'like_new', label: 'Like new' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'for_parts', label: 'For parts or repair' },
] as const;

export type Condition = (typeof CONDITIONS)[number]['value'];
