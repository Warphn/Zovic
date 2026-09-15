IMAGE_NAME = zovic-image
TAG = latest

#
build:
	docker build -t $(IMAGE_NAME):$(TAG) .

run:
	docker run -p 3000:3000 $(IMAGE_NAME):$(TAG)

stop:
	docker stop $(IMAGE_NAME) || true

clean:
	docker rmi $(IMAGE_NAME):$(TAG) || true

rebuild: clean build

.PHONY: build run