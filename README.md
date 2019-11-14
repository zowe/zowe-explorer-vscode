# Zowe Explorer

[![codecov](https://codecov.io/gh/zowe/vscode-extension-for-zowe/branch/master/graph/badge.svg)](https://codecov.io/gh/zowe/vscode-extension-for-zowe)

Zowe&trade; Explorer extension modernizes the way developers and system administrators interact with z/OS mainframes. Working with data sets and USS files from VSC can be more convenient than using 3270 emulators, and complements your Zowe CLI experience. The extension provides the following benefits:

* Enables developers to create, modify, and upload data set and USS files directly to a z/OS mainframe.
* Provides a more streamlined way to access data sets, uss files and jobs.
* Lets you create and use Zowe CLI `zosmf` compatible profiles.

**Note:** The Zowe Explorer is powered by [Zowe CLI](https://zowe.org/home/). The extension demonstrates the potential for plug-ins powered by Zowe.

**Tip:** For information about how to install the extension from a `VSIX` file and run system tests on the extension, see the [Developer README](https://github.com/zowe/vscode-extension-for-zowe/blob/master/docs/README.md).

## Contents

* [Prerequisites](#prerequisites)
* [Usage tips](#usage-tips)
* [Sample use cases](#sample-use-cases)

## Prerequisites

To use Zowe Explorer, you need to create at least one Zowe CLI `zosmf` profile.

**Notes:**

* You can use your existing Zowe CLI `zosmf` profiles that are created with the Zowe CLI v.2.0.0 or later.
* Zowe CLI `zosmf` profiles that are created in Zowe Explorer can be interchangeably used in the Zowe CLI.

### Create a Zowe CLI `zosmf` profile.

**Follow these steps:**

1. Navigate to the explorer tree.
2. Click the **+** sign next to the **DATA SETS**, **USS** or **JOBS** bar.

   **Note:** If you already have a profile, select it from the drop-down menu.

3. Select the **Create a New Connection to z/OS** option.
4. Follow the instructions, and enter all required information to complete the profile creation.

![New Connection](docs/images/ZE-create-new-connection.gif?raw=true "New Connection")
<br /><br />

You successfully created a Zowe CLI `zosmf` profile. Now you can use all the functionalities of the extension.

## Usage tips

Use the following tips to familiarize yourself with the extension and make the best use of it:

* **Data set persistence settings:** You can enable the persistence of any data sets and USS files by adding them to the **Favorites** tab. Right-click on a data set or USS file and click **Add Favorite**.

* By default, Visual Studio Code does not highlight data set syntax. To enhance the experience of using the extension, download an extension that highlights syntax, such as [IBM Z Open Editor](https://marketplace.visualstudio.com/items?itemName=IBM.zopeneditor) or [Code4z](https://marketplace.visualstudio.com/items?itemName=broadcomMFD.code4z-extension-pack).

### Advanced Configuration

You can modify Zowe Explorer preferences in the extension `Setting` in the following ways:

* **Temp Folder Location:** You can change the default folder location where temporary files are stored. For example, use the following script:

```json
"Zowe-Temp-Folder-Location": {
    "folderPath": "/path/to/directory"
  }
```

where **/path/to/directory** is the folder location that you specify.

* **Data set creation settings:** You can change the default creation settings for various data set types.

1. Navigate to the extension configuration manager.
2. In the section **Extensions**, scroll to **Zowe Configuration** and expand the options.
3. Click the **Edit in settings.json** button under the Data Set settings that you want to edit.
4. Edit the settings as needed.
5. Save the settings.

![Configure Zowe settings](docs/images/ZE-Configuration.gif?raw=true "Configure Zowe settings")
<br /><br />

## Sample use cases

Review the following use cases to understand how to use Zowe Explorer.

* [Data Sets](#data-sets)
* [USS](#uss)
* [JOBS](#jobs)
* [Extras](#extras)

### Data Sets

You can use the following functionalties when interacting with data set:

* **View data sets and use multiple filters**: You can view multiple data sets simultaneously and apply filters to show specified data sets.
* **Download, edit, and upload existing PDS members**: You can instantly pull data sets and data set members from the mainframe, edit them and upload back.
* **Use Safe Save to prevent merge conflicts**: The safe save option lets you prevent any conflicts which might arise if data sets were edited directly in the mainframe.
* **Create and delete data sets and data set members**: Enables you to easily create and delete both data sets and their members.
* **View and access multiple profiles simultaneously**: Enables to work with data sets from multiple profiles.
* **Submit a JCL**: You can submit a jcl from a chosen data set.

#### View data sets and use multiple filters

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Select the profile that you want to filter.
4. Click the **Search Data Sets by Entering Patterns** magnifying glass.
5. From the drop-down, enter the patterns that you want to filter.  
  The data sets that match your pattern(s) display in the explorer tree.

**Tip:** To provide multiple filters, separate entries with a comma. You can append or postpend any filter with an \*, which indicates wildcard searching. You cannot enter an \* as the entire pattern.

![View Data Set](docs/images/ZE-multiple-search.gif?raw=true "View Data Set")
<br /><br />

#### Refresh the list of data sets

1. Navigate to the explorer tree.
2. Click **Refresh All** button on the right of the **DATA SETS** explorer bar.

#### Download, edit, and upload existing PDS members

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Open a profile.  
4. Click the PDS member (or PS) that you want to download.

    **Note:** To view the members of a PDS, click the PDS to expand the tree.

    The PDS member displays in the text editor window of VSC.
5. Edit the document.
6. Navigate back to the PDS member (or PS) in the explorer tree, and click the **Safe Save** button.

Your PDS member (or PS) is uploaded.  

**Note:** If someone else has made changes to the PDS member (or PS) while you were editing it, you can merge your conflicts before uploading to the mainframe.

![Edit](docs/images/ZE-download-edit.gif?raw=true "Edit")
<br /><br />

#### Use Safe Save to prevent merge conflicts

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Open a profile.
4. Download and edit a data set.
5. Click the **Safe Save** button for the data set that you opened in the explorer tree.
6. Resolve merge conflicts if necessary.

![Safe Save](docs/images/ZE-safe-save.gif?raw=true "Safe Save")
<br /><br />

#### Create a new PDS and a PDS member

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Click the **Create New Data Set** button to specify the profile that you want to create the data set with.
4. From the drop-down menu, select the type of PDS that you want to create.
5. Enter a name for the PDS.
   The PDS is created.
6. To create a member, right-click the PDS and select **Create New Member**.
7. Enter a name for the member.
   The member is created.

![Create](docs/images/ZE-cre-pds-member.gif?raw=true "Create")
<br /><br />

#### Delete a PDS member and PDS

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Open the profile and PDS containing the member.
4. Right-click on the PDS member that you want to delete and select **Delete Member**.
5. Confirm the deletion by clicking **Yes** on the drop-down menu.

    **Note:** Alternatively, you can select 'No' to cancel the deletion.
6. To delete a PDS, right-click the PDS and click **Delete PDS**, then confirm the deletion.

    **Note:** You can delete a PDS before you delete its members.

![Delete](docs/images/ZE-del-pds-member.gif?raw=true "Delete")
<br /><br />

#### View and access multiple profiles simultaneously

1. Navigate to the explorer tree.
2. Open the **DATA SETS** bar.
3. Click the **Add Profile** button on the right of the **DATA SET** explorer bar.
4. Select the profile that you want to add to the view as illustrated by the following screen.

![Add Profile](docs/images/ZE-mult-profiles.gif?raw=true "Add Profile")
<br /><br />

---

### USS

You can use the following functionalties when interacting with USS files:

* **View Unix System Services (USS) files**: You can view multiple USS files simultaneously.
* **Download, edit, and upload existing USS files**: You can instantly pull USS files from the mainframe, edit them and upload back.
* **Create and delete USS files and directories**: Enables you to easily create and delete both USS files and directories.
* **View and access multiple profiles simultaneously**: Enables to work with USS files from multiple profiles.

#### View Unix System Services (USS) files

1. Navigate to the explorer tree.
2. Open the **Unix System Services (USS)** bar.
3. Select the profile that you want to filter.
4. Click the **Search Unix System Services (USS) by Entering a Path** magnifying glass.
5. From the drop-down, enter the path that you want as the root of your displayed tree.  
  All child files and directories of that root file are displayed in the explorer tree.

  **Note:** You will not be able to expand directories or files that you are not authorised for.

  ![Enter Path](docs/images/ZE-path.gif?raw=true "Enter Path")
<br /><br />

#### Refresh the list of files

1. Navigate to the explorer tree.
2. Click **Refresh All** button on the right of the **Unix System Services (USS)** explorer bar as illustrated by the following screen:

![Refresh All](docs/images/ZE-refreshUSS.gif?raw=true "Refresh All")
<br /><br />

#### Download, edit, and upload an existing file

1. Click the file that you want to download.

    **Note:** To view the files within a directory, click the directory to expand the tree.

    The file displays in the text editor window of VSC.

    **Note:** If you have defined file associations with syntax coloring the suffix of your file will be marked up.

2. Edit the document.
3. Type Ctrl-s or Command-s (OSx) to save the file

Your file is uploaded.  

![Edit](docs/images/ZE-editUSS.gif?raw=true "Edit")
<br /><br />

#### Creating and deleting files and directories

#### Create a directory

1. Navigate to the explorer tree.
2. Open the **Unix System Services (USS)** bar.
3. Select a directory that you want to add the new directory to.
4. Select the **Create directory** button and specify the directory name.
   The directory is created.

#### Create a file

1. Navigate to the explorer tree.
2. Open the **Unix System Services (USS)** bar.
3. Select a directory that you want to add the new file to.
4. Select the **Create file** button and specify the file name.
   The file is created.

#### Delete a file

1. Navigate to the explorer tree.
2. Open the **Unix System Services (USS)** bar.
3. Select a file you want to remove.
4. Select the **Delete** button and press yes in the confirmation dropdown.
   The file is deleted.

#### Delete a directory

1. Navigate to the explorer tree.
2. Open the **Unix System Services (USS)** bar.
3. Select a directory you want to remove.
4. Select the **Delete** button and press yes in the confirmation dropdown.
   The directory and all child files and directories are deleted.

![Create and Delete](docs/images/ZE-CreateDelete.gif?raw=true "Create and Delete")
<br /><br />

#### View and access multiple USS profiles simultaneously

1. Navigate to the explorer tree.
2. Open the **Unix System Services (USS)** bar.
3. Click the **Add Session** button on the right of the **Unix System Services (USS)** explorer bar.
4. Select the profile that you want to add to the view as illustrated by the following screen.

![View Profiles](docs/images/ZE-profile2.gif?raw=true "View Profiles")
<br /><br />

---

### JOBS

You can use the following functionalties when interacting with Jobs:

* **View a job**: You can view multiple jobs simultaneously.
* **Download spool content**: You can download spool content on your computer.

#### View a job

1. Navigate to the explorer tree.
2. Open the **JOBS** bar.
3. Select a directory with JCL files.
4. Right-click on the JCL you want to view, and click **Get JCL**.

![View JOB](docs/images/ZE-jobs-get-jcl.gif?raw=true "View JOB")
<br /><br />

#### Download spool content

1. Navigate to the explorer tree.
2. Open the **JOBS** bar.
3. Select a directory with JCL files.
4. Click the **Download** icon next to a folder with the spool content.
5. Save the file on your computer.

![Download Spool](docs/images/ZE-jobs-download-spool.gif?raw=true "Download Spool")
<br /><br />

---

### Extras

#### Issue TSO commands

Zowe Explorer also enables you to issue TSO command. You can issue such commands as Allocate or Exec against a profile.

1. Press the **F1** key on your keyboard.
2. Select the **Zowe:Issue TSO Command** option.
3. Select your profile.
4. Issue a TSO command.

![Issue a TSO command](docs/images/ZE-Jobs-Issue-TSO-Command.gif?raw=true "Issue a TSO command")
