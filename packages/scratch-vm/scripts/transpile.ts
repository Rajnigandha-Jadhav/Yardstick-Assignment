import * as ts from "typescript";
import * as glob from "glob";
import * as path from "path";
import * as fs from "fs";
import TypeProbe  from "./TypeProbe";

const printDiagnostics = (program: ts.Program, result: ts.EmitResult) => {
  ts.getPreEmitDiagnostics(program)
    .concat(result.diagnostics)
    .forEach(diagnostic => {
      const flattenedMessage = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n") + "\n";
      if (!diagnostic.file) return console.error(flattenedMessage);
      const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!);
      console.error(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${flattenedMessage}`);
    });
}

const tryRetrieveIdentifier = (program: ts.Program): void => {
  const typeChecker = program.getTypeChecker();
  const sources = program.getSourceFiles();
  const roots = program.getRootFileNames();
  const rootSources = sources.filter(source => roots.includes(source.fileName));
  for (const root of rootSources) {
    ts.forEachChild(root, node => {
      const type = typeChecker.getTypeAtLocation(node);
      const probes = TypeProbe.ProbeTypeForValue(type, "MyExtension");
      probes.forEach(p => p.print());
      //probe?.print();
      //probe?.findAllProbesForValue("Hello PArker").map(p => p.print());
    });
  }
}

type FileToWrite = {
  name: string,
  content: string
}

const supportingFiles: FileToWrite[] = [
  {
    name: "ONLY_EDIT_TS_FILES.md",
    content: `# NOTE TO THE DEVELOPER:
Only create and edit .ts files for this extension. 
The .js files are generated and thus any changes will be lost the next time you build the project.`
  },
];

supportingFiles.push({
  name: ".gitignore",
  content: [
    "# Prevent all .js files in this folder from being 'seen' by git",
    "**/*.js",
    "# Ignore other supporting files",
    ...supportingFiles.map(file => file.name)].join("\n")
},)

const addSuportingFiles = (dir: string) => supportingFiles.forEach(toAdd => fs.writeFileSync(path.join(dir, toAdd.name), toAdd.content));

const transpileAllTsExtensions = () => {
  const srcDir = path.resolve(__dirname, "..", "src");

  const baseOptions: ts.CompilerOptions = {
    noEmitOnError: false,
    esModuleInterop: true,
    target: ts.ScriptTarget.ES5,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    rootDir: srcDir
  };

  const extensionsDir = path.join(srcDir, "extensions");
  const supportDir = path.join(srcDir, "typescript-support");

  glob(`${extensionsDir}/**/index.ts`, (err, files) => {

    if (err) return console.error(err);
    if (!files) return console.error("No files found");

    const program = ts.createProgram(files, { ...baseOptions, outDir: srcDir, rootDir: srcDir });
    const result = program.emit();
    result.emitSkipped ? printDiagnostics(program, result) : tryRetrieveIdentifier(program);
    files.forEach(file => addSuportingFiles(path.dirname(file)));
    addSuportingFiles(supportDir);
  });
}

transpileAllTsExtensions();