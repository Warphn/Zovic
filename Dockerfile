# importing the latest tensorflow base image with GPU.
FROM tensorflow/tensorflow:latest-gpu

# set the working directory in the container
WORKDIR /usr/src/app

# copy the file requirements.txt from the current local working directory into the current container working directory
COPY requirements.txt .

# run the ubuntu update command in the container and install the PyPI requirements mentioned in the requirements.txt file
RUN apt update -q && pip install -r requirements.txt


# FONTE: https://medium.com/@pranjallk1995/docker-basics-for-beginners-with-a-complete-workflow-demo-for-yolov5-part-1-ba372f60065d