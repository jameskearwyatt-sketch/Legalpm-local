-- Make the growth-files bucket private to prevent unauthorized access
UPDATE storage.buckets SET public = false WHERE id = 'growth-files';