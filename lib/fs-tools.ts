import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const CITY_ROOT = path.resolve(
  (process.env.CITY_ROOT || "~/AgentCity").replace(/^~/, os.homedir())
);

function isWithin(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function isMissing(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function assertWithin(root: string, candidate: string) {
  if (!isWithin(root, candidate)) throw new Error("Path outside the city");
}

export async function validateCityRoot(rootPath: string, cityRoot = CITY_ROOT) {
  if (!path.isAbsolute(rootPath)) throw new Error("City root must be an absolute path");

  const base = await fs.realpath(cityRoot);
  if ((await fs.lstat(rootPath)).isSymbolicLink()) throw new Error("City root cannot be a symbolic link");
  const city = await fs.realpath(rootPath);
  const relative = path.relative(base, city);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative) ||
    relative.includes(path.sep)
  ) {
    throw new Error("City root must be a direct subfolder of CITY_ROOT");
  }

  if (!(await fs.stat(city)).isDirectory()) throw new Error("City root is not a directory");
  return city;
}

function safePath(root: string, p: string) {
  const full = path.resolve(root, p.replace(/^[/\\]+/, ""));
  assertWithin(root, full);
  return full;
}

async function existingPath(root: string, full: string) {
  const resolved = await fs.realpath(full);
  assertWithin(root, resolved);
  return resolved;
}

async function assertSafeExistingAncestor(root: string, full: string): Promise<void> {
  try {
    await existingPath(root, full);
  } catch (error) {
    if (!isMissing(error)) throw error;
    try {
      await fs.lstat(full);
      throw new Error("Cannot use an unresolved symbolic link inside the city");
    } catch (linkError) {
      if (!isMissing(linkError)) throw linkError;
    }
    const parent = path.dirname(full);
    if (parent === full) throw error;
    await assertSafeExistingAncestor(root, parent);
  }
}

async function destinationPath(root: string, full: string) {
  try {
    return await existingPath(root, full);
  } catch (error) {
    if (!isMissing(error)) throw error;
    try {
      await fs.lstat(full);
      throw new Error("Cannot write through an unresolved symbolic link");
    } catch (linkError) {
      if (!isMissing(linkError)) throw linkError;
    }
    await assertSafeExistingAncestor(root, path.dirname(full));
    return full;
  }
}

const str = { type: "string" as const };
export const fsTools = [
  { name: "list_dir", description: "List files and folders in a directory", input_schema: { type: "object" as const, properties: { path: str }, required: ["path"] } },
  { name: "read_file", description: "Read a text file", input_schema: { type: "object" as const, properties: { path: str }, required: ["path"] } },
  { name: "write_file", description: "Create or overwrite a text file", input_schema: { type: "object" as const, properties: { path: str, content: str }, required: ["path", "content"] } },
  { name: "make_dir", description: "Create a folder", input_schema: { type: "object" as const, properties: { path: str }, required: ["path"] } },
  { name: "move", description: "Move or rename a file. Never overwrites.", input_schema: { type: "object" as const, properties: { from: str, to: str }, required: ["from", "to"] } },
];

export async function runFsTool(
  name: string,
  i: any,
  cityRoot: string,
  cityRootBase = CITY_ROOT,
): Promise<string> {
  const root = await validateCityRoot(cityRoot, cityRootBase);
  switch (name) {
    case "list_dir": {
      const directory = await existingPath(root, safePath(root, i.path || "."));
      const items = await fs.readdir(directory, { withFileTypes: true });
      return items.map((d) => (d.isDirectory() ? d.name + "/" : d.name)).join("\n") || "(empty)";
    }
    case "read_file":
      return (await fs.readFile(await existingPath(root, safePath(root, i.path)), "utf8")).slice(0, 20000);
    case "write_file": {
      const target = safePath(root, i.path);
      await assertSafeExistingAncestor(root, path.dirname(target));
      await fs.mkdir(path.dirname(target), { recursive: true });
      const parent = await existingPath(root, path.dirname(target));
      const file = await destinationPath(root, path.join(parent, path.basename(target)));
      await fs.writeFile(file, i.content);
      return "Saved " + i.path;
    }
    case "make_dir": {
      const target = safePath(root, i.path);
      await assertSafeExistingAncestor(root, target);
      await fs.mkdir(target, { recursive: true });
      await existingPath(root, target);
      return "Created " + i.path;
    }
    case "move": {
      const from = await existingPath(root, safePath(root, i.from));
      const target = safePath(root, i.to);
      await assertSafeExistingAncestor(root, path.dirname(target));
      await fs.mkdir(path.dirname(target), { recursive: true });
      const parent = await existingPath(root, path.dirname(target));
      const to = path.join(parent, path.basename(target));
      try {
        await fs.lstat(to);
        throw new Error("Destination exists");
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
      await fs.rename(from, to);
      return `Moved ${i.from} to ${i.to}`;
    }
  }
  throw new Error("Unknown tool " + name);
}

export async function writeCityFile(
  relativePath: string,
  content: Uint8Array,
  cityRoot: string,
  cityRootBase = CITY_ROOT,
) {
  const root = await validateCityRoot(cityRoot, cityRootBase);
  const target = safePath(root, relativePath);
  await assertSafeExistingAncestor(root, path.dirname(target));
  await fs.mkdir(path.dirname(target), { recursive: true });

  const parent = await existingPath(root, path.dirname(target));
  const file = path.join(parent, path.basename(target));
  await destinationPath(root, file);
  await fs.writeFile(file, content, { flag: "wx" });
}

export async function readCityFile(
  relativePath: string,
  cityRoot: string,
  cityRootBase = CITY_ROOT,
) {
  const root = await validateCityRoot(cityRoot, cityRootBase);
  const file = await existingPath(root, safePath(root, relativePath));
  return fs.readFile(file);
}
