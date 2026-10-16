import {serverMetadata} from '@/lib/oauth';
// Authorization server metadata (RFC 8414): where Claude registers, sends the person to sign in and gets tokens.
export function GET(req:Request){return Response.json(serverMetadata(new URL(req.url).origin),{headers:{'Cache-Control':'public, max-age=300','Access-Control-Allow-Origin':'*'}});}
