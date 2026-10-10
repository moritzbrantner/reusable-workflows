{
  description = "Opt-in genuine NixOS VM agent-environment probe (not a production runner)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/4975466d324710c576dc11ad614684e6bd8cad8e";

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      nixos = nixpkgs.lib.nixosSystem {
        inherit system;
        modules = [
          ({ pkgs, ... }:
            let
              fixture = pkgs.runCommand "agent-environment-fixture" {} ''
                mkdir -p "$out"
                cp ${./probe.mjs} "$out/probe.mjs"
                cp ${./probe-check.mjs} "$out/probe-check.mjs"
                cp ${./fixture.json} "$out/fixture.json"
              '';
            in {
              networking.hostName = "agent-pilot";
              system.stateVersion = "26.05";

              virtualisation.vmVariant.virtualisation = {
                memorySize = 4096;
                cores = 3;
              };

              systemd.services.agent-environment-probe = {
                description = "Run the identical deterministic environment probe inside NixOS";
                wantedBy = [ "multi-user.target" ];
                after = [ "network.target" ];
                serviceConfig = {
                  Type = "oneshot";
                  StandardOutput = "journal+console";
                  StandardError = "journal+console";
                };
                script = ''
                  set -eu
                  ${pkgs.nodejs_24}/bin/node --test ${fixture}/probe-check.mjs
                  ${pkgs.nodejs_24}/bin/node ${fixture}/probe.mjs ${fixture}/fixture.json
                  echo ENV_PILOT_GUEST_COMPLETE
                  ${pkgs.systemd}/bin/systemctl --no-block poweroff
                '';
              };
            })
        ];
      };
    in {
      packages.${system}.nixosVM = nixos.config.system.build.vm;
    };
}
