.PHONY: build clean commit deploy

build: clean
	npm run build

deploy: .git public
	git subtree push --prefix public origin gh-pages

commit:
	git add .
	git commit -m "commit"

clean:
	rm -rf public
