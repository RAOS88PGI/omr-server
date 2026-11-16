# Server OMR: Node (server.js) + Audiveris dibangun dari sumber resmi.
# BELUM DIUJI di hosting nyata. Jika build gagal, lihat log build Railway.
FROM eclipse-temurin:21-jdk AS build
ARG AUDIVERIS_REF=5.10.2
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch ${AUDIVERIS_REF} https://github.com/Audiveris/audiveris.git /src
WORKDIR /src
RUN ./gradlew --no-daemon build -x test
RUN mkdir -p /opt/audiveris && tar -xf app/build/distributions/*.tar -C /opt/audiveris --strip-components=1 && test -x /opt/audiveris/bin/Audiveris

FROM eclipse-temurin:21-jre
RUN apt-get update && apt-get install -y --no-install-recommends nodejs tesseract-ocr tesseract-ocr-eng fontconfig libfreetype6 && rm -rf /var/lib/apt/lists/*
COPY --from=build /opt/audiveris /opt/audiveris
WORKDIR /app
COPY server.js .
ENV AUDIVERIS_BIN=/opt/audiveris/bin/Audiveris PORT=8080 JAVA_OPTS="-Xmx1500m -Djava.awt.headless=true" TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata
EXPOSE 8080
CMD ["node","server.js"]
