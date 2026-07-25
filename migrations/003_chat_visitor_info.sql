-- Migration: Add visitor info columns to chat_messages table
-- Run this on your MySQL database

ALTER TABLE chat_messages 
  ADD COLUMN visitor_name VARCHAR(255) NULL AFTER content,
  ADD COLUMN visitor_email VARCHAR(320) NULL AFTER visitor_name,
  ADD COLUMN visitor_phone VARCHAR(50) NULL AFTER visitor_email,
  ADD COLUMN is_read ENUM('unread', 'read') DEFAULT 'unread' NOT NULL AFTER visitor_phone;

-- Update existing messages to be marked as read
UPDATE chat_messages SET is_read = 'read' WHERE is_read IS NULL;

-- Modify role enum to include admin
ALTER TABLE chat_messages 
  MODIFY COLUMN role ENUM('user', 'assistant', 'admin') NOT NULL;
