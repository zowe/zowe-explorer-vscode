interface DatasetAttributesDefinition {
    id: string;
    name: string;
    description?: string;
}

const dsnameAttribute: DatasetAttributesDefinition = {
    id: "dsname",
    name: "Data Set Name",
    description: "The name of the dataset",
};

export const DATASET_ATTR_DEFS: DatasetAttributesDefinition[] = [
    dsnameAttribute,
    {
        id: "alloc",
        name: "Allocated Units",
    },
    {
        id: "allocx",
        name: "Allocated Extents",
    },
    {
        id: "blksz",
        name: "Block Size",
        description: "The block size of the dataset",
    },
    {
        id: "catnm",
        name: "Catalog Name",
        description: "The catalog in which the dataset entry is stored",
    },
    {
        id: "cdate",
        name: "Create Date",
        description: "The dataset creation date",
    },
    {
        id: "dataclass",
        name: "Data Class",
    },
    {
        id: "dev",
        name: "Device Type",
        description: "The type of the device the dataset is stored on",
    },
    {
        id: "dsntp",
        name: "Data Set Type",
        description: "LIBRARY, (LIBRARY,1), (LIBRARY,2), PDS, HFS, EXTREQ, EXTPREF, BASIC or LARGE",
    },
    {
        id: "dsorg",
        name: "Data Set Organization",
        description: "PS, PO, or DA",
    },
    {
        id: "edate",
        name: "Expiration Date",
        description: "The dataset expiration date",
    },
    {
        id: "encrypted",
        name: "Encryption",
    },
    {
        id: "extx",
        name: "Extensions",
        description: "The number of extensions the dataset has",
    },
    {
        id: "lrecl",
        name: "Logical Record Length",
        description: "The length in bytes of each record",
    },
    {
        id: "migr",
        name: "Migration",
        description: "Indicates if automatic migration is active",
    },
    {
        id: "mgmtclass",
        name: "Management Class",
    },
    {
        id: "mvol",
        name: "Multivolume",
        description: "Whether the dataset is on multiple volumes",
    },
    {
        id: "ovf",
        name: "Space overflow",
        description: "Indicates if space overflow was encountered (YES or NO)",
    },
    {
        id: "primary",
        name: "Primary Space",
    },
    {
        id: "rdate",
        name: "Reference Date",
        description: "Last referenced date",
    },
    {
        id: "recfm",
        name: "Record Format",
        description: "Valid values: A, B, D, F, M, S, T, U, V (combinable)",
    },
    {
        id: "secondary",
        name: "Secondary Space",
    },
    {
        id: "sizex",
        name: "Size",
        description: "Size of the first extent in tracks",
    },
    {
        id: "spacu",
        name: "Space Unit",
        description: "Type of space units measurement",
    },
    {
        id: "storclass",
        name: "Storage Class",
    },
    {
        id: "used",
        name: "Used Space",
        description: "Used space percentage",
    },
    {
        id: "usedx",
        name: "Used Extents",
    },
    {
        id: "vol",
        name: "Volume",
        description: "Volume serial numbers for data set",
    },
    {
        id: "vols",
        name: "Volumes",
        description: "Multiple volume serial numbers",
    },
];

export const MEMBER_ATTR_DEFS: DatasetAttributesDefinition[] = [
    dsnameAttribute,
    {
        id: "member",
        name: "Member Name",
        description: "The name of the member",
    },
    {
        id: "vers",
        name: "Version",
        description: "Member version number",
    },
    {
        id: "mod",
        name: "Modification Level",
        description: "Member modification level",
    },
    {
        id: "c4date",
        name: "Created Date",
        description: "Creation date (4-character year format)",
    },
    {
        id: "m4date",
        name: "Modified Date",
        description: "Last change date (4-character year format)",
    },
    {
        id: "mtime",
        name: "Modified Time",
        description: "Last change time (in format hh:mm)",
    },
    {
        id: "msec",
        name: "Modified Seconds",
        description: "Seconds value of the last change time",
    },
    {
        id: "cnorc",
        name: "Current Records",
        description: "Current number of records",
    },
    {
        id: "inorc",
        name: "Initial Records",
        description: "Initial number of records",
    },
    {
        id: "mnorc",
        name: "Modified Records",
        description: "Number of changed records",
    },
    {
        id: "user",
        name: "User",
        description: "User ID of last user to change the given member",
    },
    {
        id: "sclm",
        name: "Modified by ISPF/SCLM",
        description: "Indicates whether the member was last modified by SCLM or ISPF",
    },
];
