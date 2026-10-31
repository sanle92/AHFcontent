-- Optional supplied merchandise concepts, no prices, inventory or payment claims.
-- Idempotent: does not overwrite existing editorial work.
begin;
do $$declare r content_items;v jsonb;begin
 for v in select * from jsonb_array_elements('[{"slug":"ahf-tshirt","title":"The AHF T-shirt","summary":"Wear the belief. A foundation-branded T-shirt concept for merchandise fundraising.","body":"AHF-branded T-shirts are part of our merchandise fundraising plans. Enquire about designs, sizes and confirmed availability before placing an order.","details":{"currency":"UGX","availability":"Enquire","variants":"Sizes and colours to be confirmed","fulfilment":"Collection, delivery and pricing will be confirmed by the foundation.","proceeds":"Merchandise fundraising is intended to support the foundation’s community-based work. The contribution from sales will be confirmed with the product details."}},{"slug":"ahf-mug","title":"A mug full of hope","summary":"An everyday reminder of shared hope. Explore the AHF-branded mug concept.","body":"AHF-branded mugs are being developed for merchandise fundraising. Contact us to discuss confirmed designs and order arrangements.","details":{"currency":"UGX","availability":"Enquire","fulfilment":"Price, stock and collection or delivery arrangements will be confirmed before an order.","proceeds":"This planned fundraising product supports Aminia Hope Foundation. Confirmed fundraising information will be shared before sale."}}]'::jsonb) loop
 if not exists(select 1 from content_items where kind='product' and slug=v->>'slug') then
 insert into content_items(kind,slug,title,summary,body,details,status) values('product',v->>'slug',v->>'title',v->>'summary',v->>'body',v->'details','Published') returning * into r;
 insert into publications(content_id,version,snapshot) values(r.id,r.version,jsonb_build_object('kind',r.kind,'slug',r.slug,'title',r.title,'summary',r.summary,'body',r.body,'details',r.details,'cover_id',null));
 end if;end loop;
end $$;
commit;
