import {redirect} from 'next/navigation';
import {getUser} from '@/lib/auth';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}){if(await getUser())redirect('/');const{error}=await searchParams;return <main className="login-page"><form className="surface login-card" method="post" action="/api/login"><img className="login-logo" src="/bhb-logo.png" alt="BHB Business Centre"/><h1>Sign in</h1><label className="field"><span>Password</span><input type="password" name="password" required autoFocus autoComplete="current-password"/></label>{error&&<p className="error-banner" role="alert">Incorrect password. Please try again.</p>}<button className="primary" type="submit">Sign in</button></form></main>;}
