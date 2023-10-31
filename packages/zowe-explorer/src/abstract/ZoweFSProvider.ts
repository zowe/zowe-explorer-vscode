import { Disposable, Event, FileChangeEvent, FileStat, FileSystemProvider, FileType, Uri } from "vscode";
import { UssFSProvider } from "../uss/fs";

// While a generic provider would be nice, it may make the implementation more complicated.
// 
// FileSystemProvider requires a schema (protocol) during registration, and you cannot register a provider without a schema.
// This means that only the generic Zowe provider would be registered as a FileSystemProvider,
// and this provider would dispatch all calls based on the beginning of the URI.
//
// With a generic provider such as the one below, we'd still have a FileSystemProvider for each type, but they wouldn't be registered.
// In addition, any benefits of registering the provider under its own schema will not be provided to the "sub-providers".
export class ZoweFSProvider implements FileSystemProvider {
    private static inst: ZoweFSProvider;
    private constructor() {}

    public get instance(): ZoweFSProvider {
        if (!ZoweFSProvider.inst) {
            ZoweFSProvider.inst = new ZoweFSProvider();
        }
        return ZoweFSProvider.inst;
    }

    public onDidChangeFile: Event<FileChangeEvent[]>;
    
    public watch(uri: Uri, options: { readonly recursive: boolean; readonly excludes: readonly string[]; }): Disposable {
        if (uri.path.startsWith("/uss/")) {
            return UssFSProvider.instance.watch(uri, options);
        } else if (uri.path.startsWith("/ds/")) {
            // return DSFSProvider.instance.stat(uri);
        }
    }

    public stat(uri: Uri): FileStat | Thenable<FileStat> {
        if (uri.path.startsWith("/uss/")) {
            return UssFSProvider.instance.stat(uri);
        } else if (uri.path.startsWith("/ds/")) {
            // return DSFSProvider.instance.stat(uri);
        } else if (uri.path.startsWith("/jobs/")) {
            // return JobsFSProvider.instance.stat(uri);
        }

        throw new Error("Method not implemented.");
    }

    public readDirectory(uri: Uri): [string, FileType][] | Thenable<[string, FileType][]> {    
        if (uri.path.startsWith("/uss/")) {
            return UssFSProvider.instance.readDirectory(uri);
        } else if (uri.path.startsWith("/ds/")) {
            // return DSFSProvider.instance.readDirectory(uri);
        } else if (uri.path.startsWith("/jobs/")) {
            // return JobsFSProvider.instance.readDirectory(uri);
        }
    
        throw new Error("Method not implemented for the given path.");
    }

    public createDirectory(uri: Uri): void | Thenable<void> {
        if (uri.path.startsWith("/uss/")) {
            return UssFSProvider.instance.createDirectory(uri);
        } else if (uri.path.startsWith("/ds/")) {
            // return DSFSProvider.instance.createDirectory(uri);
        } else if (uri.path.startsWith("/jobs/")) {
            // return JobsFSProvider.instance.createDirectory(uri);
        }
    
        throw new Error("Method not implemented.");
    }

    public readFile(uri: Uri): Uint8Array | Thenable<Uint8Array> {
        if (uri.path.startsWith("/uss/")) {
            return UssFSProvider.instance.readFile(uri);
        } else if (uri.path.startsWith("/ds/")) {
            // return DSFSProvider.instance.readFile(uri);
        } else if (uri.path.startsWith("/jobs/")) {
            // return JobsFSProvider.instance.readFile(uri);
        }

        throw new Error("Method not implemented.");
    }

    public writeFile(uri: Uri, content: Uint8Array, options: { readonly create: boolean; readonly overwrite: boolean; }): void | Thenable<void> {
        if (uri.path.startsWith("/uss/")) {
            return UssFSProvider.instance.writeFile(uri, content, options);
        } else if (uri.path.startsWith("/ds/")) {
            // return DSFSProvider.instance.writeFile(uri);
        } else if (uri.path.startsWith("/jobs/")) {
            // return JobsFSProvider.instance.writeFile(uri);
        }

        throw new Error("Method not implemented.");
    }

    public delete(uri: Uri, options: { readonly recursive: boolean; }): void | Thenable<void> {
        if (uri.path.startsWith("/uss/")) {
            return UssFSProvider.instance.delete(uri, options);
        } else if (uri.path.startsWith("/ds/")) {
            // return DSFSProvider.instance.delete(uri, options);
        }
        
        throw new Error("Method not implemented.");
    }

    public rename(oldUri: Uri, newUri: Uri, options: { readonly overwrite: boolean; }): void | Thenable<void> {
        if (oldUri.path.startsWith("/uss/")) {
            return UssFSProvider.instance.rename(oldUri, newUri, options);
        } else if (oldUri.path.startsWith("/ds/")) {
            // return DSFSProvider.instance.delete(uri);
        }
        throw new Error("Method not implemented.");
    }

    public copy?(source: Uri, _destination: Uri, _options: { readonly overwrite: boolean; }): void | Thenable<void> {
        if (source.path.startsWith("/uss/")) {
            //return UssFSProvider.instance.copyEx(source, destination, options);
        } else if (source.path.startsWith("/ds/")) {
            // return DSFSProvider.instance.delete(uri);
        }
        throw new Error("Method not implemented.");
    }
}