-- CreateTable
CREATE TABLE `session` (
    `unique` INTEGER NOT NULL AUTO_INCREMENT,
    `id` VARCHAR(191) NOT NULL,
    `shop` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `isOnline` BOOLEAN NOT NULL DEFAULT false,
    `scope` VARCHAR(191) NULL,
    `expires` DATETIME(3) NULL,
    `accessToken` VARCHAR(191) NOT NULL,
    `userId` BIGINT NULL,

    UNIQUE INDEX `unique_2`(`unique`),
    INDEX `unique`(`unique`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `discountrules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `type` VARCHAR(255) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `startat` DATETIME(3) NOT NULL,
    `endat` DATETIME(3) NULL,
    `conditions` JSON NULL,
    `selectproducts` JSON NULL,
    `selectcollection` JSON NULL,
    `discount` JSON NULL,
    `varprodcheck` JSON NULL,
    `products` JSON NULL,
    `customcode` VARCHAR(255) NULL,
    `multiproduct` JSON NULL,
    `appliedtype` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
