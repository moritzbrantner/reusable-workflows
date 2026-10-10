{
  description = "Optional agent CI-environment feasibility comparison; not a repository toolchain";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/4975466d324710c576dc11ad614684e6bd8cad8e";

  outputs =
    { nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        packages = [ pkgs.nodejs_24 ];
      };

      checks.${system}.guest-smoke = pkgs.testers.runNixOSTest {
        name = "agent-ci-environment-nixos-smoke";
        nodes.machine =
          { pkgs, ... }:
          {
            system.stateVersion = "25.05";
            environment.systemPackages = [ pkgs.nodejs_24 ];
          };

        testScript = ''
          machine.start()
          machine.wait_for_unit("multi-user.target")
          print(machine.succeed("PILOT_EXPECT_OS=nixos PILOT_REQUIRE_NODE24=1 node ${./smoke.mjs} ${./fixture.json}"))
        '';
      };
    };
}
