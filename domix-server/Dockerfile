# syntax=docker/dockerfile:1.7
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG EXTRA_CA_SHA256=none
WORKDIR /src
# The SDK's own HTTPS requests (NuGet) also need explicit extra trust behind NetFree.
RUN --mount=type=secret,id=extra_ca,required=false \
    test -n "$EXTRA_CA_SHA256" && if [ -s /run/secrets/extra_ca ]; then \
      ! grep -q 'PRIVATE KEY' /run/secrets/extra_ca \
      && grep -q 'BEGIN CERTIFICATE' /run/secrets/extra_ca \
      && awk '/BEGIN CERTIFICATE/{n++} n{print > ("/usr/local/share/ca-certificates/domix-extra-" n ".crt")}' /run/secrets/extra_ca \
      && update-ca-certificates; fi
COPY ["domix-server.csproj", "./"]
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
ARG EXTRA_CA_SHA256=none
WORKDIR /app
COPY --from=build /app/publish .
# No extra CA is trusted unless the opt-in build secret was explicitly provided.
RUN --mount=type=secret,id=extra_ca,required=false \
    test -n "$EXTRA_CA_SHA256" && if [ -s /run/secrets/extra_ca ]; then \
      ! grep -q 'PRIVATE KEY' /run/secrets/extra_ca \
      && grep -q 'BEGIN CERTIFICATE' /run/secrets/extra_ca \
      && awk '/BEGIN CERTIFICATE/{n++} n{print > ("/usr/local/share/ca-certificates/domix-extra-" n ".crt")}' /run/secrets/extra_ca \
      && update-ca-certificates; fi
ENTRYPOINT ["dotnet", "domix-server.dll"]
