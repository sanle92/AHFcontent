-- Proposed faith wording: preserves the live About snapshot until reviewed/published.
begin;
update content_items set body='We are believers in Jesus Christ. Our faith inspires us to share the gospel through evangelism and express Christ’s love through compassionate, practical service. Support is offered without requiring religious participation or agreement with our beliefs.'||E'\n\n'||body,
 details=details||jsonb_build_object('vision','Rooted in our faith in Jesus Christ, to break the cycle of poverty and transform lives through hope: hope for every family, a brighter future for every child, and restored hope and dignity for the elderly and the vulnerable.','mission','To share the gospel of Jesus Christ through evangelism and express His love through practical, community-based programmes supporting children, families and communities, serving with dignity and without discrimination.'),status='Draft',approved_by=null,version=version+1,updated_at=now()
 where kind='page' and slug='about' and status='Published' and body not like '%Jesus Christ%';
commit;
