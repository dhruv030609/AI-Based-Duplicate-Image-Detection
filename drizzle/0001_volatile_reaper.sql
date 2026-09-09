CREATE TABLE `scanAssets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scanId` int NOT NULL,
	`groupId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileSize` int NOT NULL DEFAULT 0,
	`width` int NOT NULL DEFAULT 0,
	`height` int NOT NULL DEFAULT 0,
	`sourceFolder` varchar(255),
	`duplicateType` varchar(80),
	`qualityScore` int NOT NULL DEFAULT 0,
	`recommendation` enum('keep','remove','review') NOT NULL DEFAULT 'review',
	`fingerprint` text,
	`isKeeper` int NOT NULL DEFAULT 0,
	CONSTRAINT `scanAssets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scanGroups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scanId` int NOT NULL,
	`label` varchar(255) NOT NULL,
	`note` text NOT NULL,
	`similarity` int NOT NULL,
	`accent` enum('coral','blue','ink') NOT NULL DEFAULT 'blue',
	CONSTRAINT `scanGroups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`fileCount` int NOT NULL DEFAULT 0,
	`duplicateGroupCount` int NOT NULL DEFAULT 0,
	`reclaimableBytes` int NOT NULL DEFAULT 0,
	`threshold` int NOT NULL DEFAULT 10,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scans_id` PRIMARY KEY(`id`)
);
