#!/usr/bin/perl

use File::Path qw(make_path);
use Cwd 'abs_path';

print "compiling script files...\n";

# reading comandline arguments
my $prefix= "~/compiled-application-frame";
my $compilerPrefix= "./";
foreach(@ARGV){
  my ($name, $value) = split(/=/, $_);
  if($name eq '--prefix'){
    $prefix= $value;
  }
}

print "fetching filelist...\n";
my @fileList= ();

# get commplete filelist
opendir($root, '.') or die $!;

while (my $dir = readdir($root)) {
    if ($dir ne '.' && $dir ne '..'){
        push(@fileList, "./$dir");
	}
}    
closedir($root);

foreach(@fileList){
    if(-d $_){
        opendir($handler, $_) or die $!;
        while (my $dir = readdir($handler)){
            if ($dir ne '.' && $dir ne '..'){
                push(@fileList, "$_/$dir");
        	}
        }
        closedir($handler);
	}
}
@fileList= sort(@fileList);
@fileList= grep(/.*\.js$/, @fileList);

#excluded directories
@fileList= grep(!/^.\/\.travis(?!\.).*$/, @fileList);
@fileList= grep(!/^.\/closure-compiler(?!\.).*$/, @fileList);
@fileList= grep(!/^.\/traceur-compiler(?!\.).*$/, @fileList);
@fileList= grep(!/^.\/compiled(?!\.).*$/, @fileList);

# preparing closure compiler
if(not -e './closure-compiler/'){
	print "cloning the closure-compiler source...\n";
	print `git clone https://github.com/google/closure-compiler`;
}

if(not -e './closure-compiler/build/compiler.jar'){
	print "building the closure-compiler, this will take a while...\n";
	print `cd ./closure-compiler/ && ant jar`;
}

if(not -e './closure-compiler/compiler.jar'){
	print "copying compiler jar...\n";
	print `cp ./closure-compiler/build/compiler.jar ./closure-compiler/compiler.jar`;
}

# preparing closure compiler
if(not -e './traceur-compiler'){
	print "cloning traceur-compiler...\n";
	print `git clone https://github.com/google/traceur-compiler`;
}

if(not -e './traceur-compiler/bin'){
	print "building the traceur-compiler...\n";
	print `cd ./traceur-compiler && make clean && make`;
}

# compile the files
foreach(@fileList){
	my $originFile= abs_path($_);
	my $fileName= abs_path($prefix.substr($_, 1));
	my $tempFile= abs_path("$prefix/temp.js");
	my $path = substr($fileName, 0, rindex($fileName, "/"));
	make_path($path);
	print "compiling \"$originFile\" to \"$fileName\"...\n";
	print `cd $compilerPrefix.traceur-compiler && ./traceur --experimental --script $originFile --out $tempFile`;
	print `cd $compilerPrefix.closure-compiler && java -jar compiler.jar -O SIMPLE --language_in ECMASCRIPT5_STRICT --js $tempFile --js_output_file $fileName`;
	unlink($tempFile);
}

