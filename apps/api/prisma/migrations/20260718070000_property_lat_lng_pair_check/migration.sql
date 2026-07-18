-- Both null or both set — never one-sided coordinates.
ALTER TABLE "Property"
ADD CONSTRAINT "Property_lat_lng_pair_check"
CHECK (("latitude" IS NULL) = ("longitude" IS NULL));
