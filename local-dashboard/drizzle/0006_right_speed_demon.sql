CREATE UNIQUE INDEX `invoice_owner_payment` ON `invoices` (`owner`, json_extract(`data`, '$.paymentId'));
