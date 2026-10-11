import {z} from 'zod';
export const enquiryStatuses=['New','Contacted','Closed'] as const;
export const enquirySchema=z.object({name:z.string().trim().min(1,'Enter your name').max(100),email:z.string().trim().email('Enter a valid email address').max(200),phone:z.string().trim().max(30).regex(/^[+\d\s()-]*$/,'Use digits, spaces and + in the phone number').default(''),service:z.string().trim().max(80).default('General enquiry'),message:z.string().trim().min(1,'Tell us about your plans').max(2000),page:z.string().trim().max(200).default('')});
export type Enquiry=z.infer<typeof enquirySchema>&{id:string;created:string;status:typeof enquiryStatuses[number]};
