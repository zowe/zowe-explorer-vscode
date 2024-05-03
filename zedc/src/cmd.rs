use clap::{command, Parser, Subcommand};

#[derive(Subcommand)]
pub enum RootCommands {
    #[command(
        name = "pkg-manager",
        about = "Forward commands to the applicable package manager",
        visible_alias = "pm"
    )]
    PkgMgr {},
    #[command(
        name = "setup",
        about = "Setup required dependencies to facilitate Zowe Explorer development",
        visible_alias = "s"
    )]
    Setup {
        #[arg(
            default_value = None,
            help = "A Git ref to checkout when setting up the environment",
            long,
            short,
            value_name = "REF"
        )]
        reference: Option<String>,
    },
    #[command(
        name = "test",
        about = "Manually test Zowe Explorer or an extender",
        visible_alias = "t"
    )]
    Test {
        #[command(subcommand)]
        subcommand: crate::test::Commands,
        #[arg(
            default_value = None,
            default_missing_value = Some("latest"),
            help = "Installs the given version of Zowe CLI",
            global = true,
            long,
            value_name = "VERSION",
            num_args = 0
        )]
        install_cli: Option<String>,
        #[arg(default_value = None, help = "The VS Code version to use for testing", long, value_name = "VERSION", global = true)]
        vsc_version: Option<String>,
    },
    #[command(
        name = "version",
        about = "Prints the version info for the zedc tool",
        alias = "v"
    )]
    Version,
}

#[derive(Parser)]
pub struct Args {
    #[command(subcommand)]
    pub command: RootCommands,
}
