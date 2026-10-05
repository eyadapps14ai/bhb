import {clearedSessionCookie} from '@/lib/auth';
export async function POST(req:Request){return new Response(null,{status:303,headers:{Location:'/login','Set-Cookie':clearedSessionCookie(req),'Cache-Control':'no-store'}});}
