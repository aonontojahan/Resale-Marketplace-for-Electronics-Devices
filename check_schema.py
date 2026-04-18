from sqlalchemy import create_engine, MetaData, Table

engine = create_engine('postgresql://aonontojahan:aonontojahan@localhost/resale_db')
metadata = MetaData()
product_images = Table('product_images', metadata, autoload_with=engine)
print([c.name for c in product_images.columns])
