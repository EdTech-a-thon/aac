# Button Action stored as one optional JSONB value

A Button may have zero or one Action with several kinds and payloads. We store that as a single nullable `buttons.action` JSONB column (discriminated by `kind`) and pass the same shape through Change Set create/update button mutations, rather than parallel nullable columns per kind. Parallel columns would allow illegal combinations; a separate actions table would over-model a value that always belongs to exactly one Button.
