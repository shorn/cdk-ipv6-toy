Everything in this dir gets ignored.

It can be used for storing input files, data files, output files, temporary 
build files or caches, whatever.  

Basically, anything you're sure you don't want committed.

*BUT NOT SECRETS!*

Don't put secrets in this dir, even prod data is probably a bad idea.
If someone accidentally mis-configures the ignore file, folks might accidentally
commit files containing secrets.

The `/local` directory is redundantly specified in both `/` root and the `
/local` directory `.gitignore` files to try to prevent misconfiguration, but 
it could still happen.
