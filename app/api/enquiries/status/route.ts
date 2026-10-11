import {z} from 'zod';
import {enquiryStatuses} from '@/lib/enquiries';
import {context,failure} from '@/lib/server-records';
const update=z.object({id:z.string().min(1),status:z.enum(enquiryStatuses)});
export async function POST(req:Request){try{const{db}=await context(req);const{id,status}=update.parse(await req.json());if(!await db.prepare('UPDATE enquiries SET status=? WHERE id=? RETURNING id').bind(status,id).first())throw new Error('Enquiry not found.');return Response.json({id,status});}catch(e){return failure(e);}}
