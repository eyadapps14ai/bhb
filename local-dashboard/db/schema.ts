import {sql} from 'drizzle-orm';
import {sqliteTable,text,integer,index,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const offices=sqliteTable('offices',{id:text('id').primaryKey(),owner:text('owner').notNull(),code:text('code').notNull(),data:text('data').notNull()},t=>[uniqueIndex('office_owner_code').on(t.owner,t.code)]);
export const payments=sqliteTable('payments',{id:text('id').primaryKey(),owner:text('owner').notNull(),officeId:text('office_id').references(()=>offices.id),data:text('data').notNull()},t=>[index('payment_owner').on(t.owner),index('payment_office').on(t.officeId)]);
export const documents=sqliteTable('documents',{id:text('id').primaryKey(),owner:text('owner').notNull(),officeId:text('office_id').notNull().references(()=>offices.id),paymentId:text('payment_id').references(()=>payments.id),name:text('name').notNull(),category:text('category').notNull(),mime:text('mime').notNull(),size:integer('size').notNull(),key:text('key').notNull(),created:text('created').notNull()},t=>[index('document_owner').on(t.owner),index('document_office').on(t.officeId)]);

export const leases=sqliteTable('leases',{id:text('id').primaryKey(),owner:text('owner').notNull(),officeId:text('office_id').notNull().references(()=>offices.id),data:text('data').notNull()},t=>[index('lease_owner_office').on(t.owner,t.officeId)]);

export const employeeRequests=sqliteTable('employee_requests',{id:text('id').primaryKey(),owner:text('owner').notNull(),data:text('data').notNull()},t=>[index('employee_request_owner').on(t.owner)]);

export const employees=sqliteTable('employees',{id:text('id').primaryKey(),owner:text('owner').notNull(),data:text('data').notNull()},t=>[index('employee_owner').on(t.owner)]);

export const emailConnections=sqliteTable('email_connections',{id:text('id').primaryKey(),owner:text('owner').notNull(),data:text('data').notNull()},t=>[index('email_connection_owner').on(t.owner)]);

export const invoiceIssuers=sqliteTable('invoice_issuers',{id:text('id').primaryKey(),owner:text('owner').notNull(),data:text('data').notNull()});
export const invoices=sqliteTable('invoices',{seq:integer('seq').primaryKey({autoIncrement:true}),id:text('id').notNull().unique(),owner:text('owner').notNull(),officeId:text('office_id').notNull().references(()=>offices.id),data:text('data').notNull()},t=>[index('invoice_owner').on(t.owner),uniqueIndex('invoice_owner_payment').on(t.owner,sql`json_extract(${t.data}, '$.paymentId')`)]);
