import {redirect} from 'next/navigation';
import {getUser} from '@/lib/auth';
import Centre from './centre';
export const dynamic='force-dynamic';
export default async function Home(){if(!await getUser())redirect('/login');return <Centre/>;}
