-- Make the growth-files bucket public so documents can be viewed
UPDATE storage.buckets SET public = true WHERE id = 'growth-files';