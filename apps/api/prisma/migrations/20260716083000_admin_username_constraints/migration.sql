-- AlterColumn: username TEXT -> VARCHAR(64)
ALTER TABLE "Admin" ALTER COLUMN "username" SET DATA TYPE VARCHAR(64);

-- Enforce username length at the database (app also validates)
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_username_length_check" CHECK (char_length("username") >= 3 AND char_length("username") <= 64);
